import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { OFXParserService, OFXTransaction } from './ofx-parser.service';
import { CategoryInferenceService } from './category-inference.service';
import { IBankAccountRepository } from '../../core/repositories/bank-account.repository.interface';
import { ITransactionRepository } from '../../core/repositories/transaction.repository.interface';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

const FREE_PLAN_TRANSACTION_LIMIT = 50;

export interface ImportResult {
  imported: number;
  duplicates: number;
  total: number;
  accountCreated?: boolean;
  accountName?: string;
  alreadyImported?: boolean;
  previousImportAt?: string;
  /** Período do extrato (BANKTRANLIST), quando identificável. */
  periodStart?: string;
  periodEnd?: string;
  /** Saldo recalculado a partir do histórico + novas transações. */
  calculatedBalance?: number;
  /** Saldo informado pelo banco (LEDGERBAL), quando presente no arquivo. */
  bankBalance?: number;
  /** calculatedBalance - bankBalance. */
  divergence?: number;
  /** false = divergência de conciliação; nada foi persistido (repita com `force`). */
  reconciled?: boolean;
  /** true quando a importação foi interrompida aguardando confirmação. */
  requiresConfirmation?: boolean;
  /** true quando uma transação de ajuste foi criada para cobrir `divergence`. */
  adjusted?: boolean;
  /** Data até a qual o saldo está confirmado por extrato (nem sempre é "hoje"). */
  balanceAsOf?: string;
  /** Ajustes de conciliação existentes que um extrato retroativo pode ter tornado redundantes. */
  possibleRedundantAdjustments?: {
    id: string;
    date: string;
    amount: number;
    type: 'income' | 'expense';
    description: string | null;
  }[];
}

function fuzzyKey(t: { date: string; amount: number; type: string }): string {
  return `${t.date}|${t.amount}|${t.type}`;
}

@Injectable()
export class StatementImportService {
  constructor(
    private readonly ofxParser: OFXParserService,
    private readonly categoryInference: CategoryInferenceService,
    @Inject(IBankAccountRepository)
    private readonly bankAccountRepository: IBankAccountRepository,
    @Inject(ITransactionRepository)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async importOFX(
    bankAccountId: string | null,
    workspaceId: string,
    buffer: Buffer,
    filename?: string,
    force = false,
    /** Confia no saldo do banco e cria uma transação de ajuste pela diferença. */
    adjustToBankBalance = false,
  ): Promise<ImportResult> {
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    if (!force) {
      const existing = await this.db
        .select({ id: schema.statementImport.id, createdAt: schema.statementImport.createdAt })
        .from(schema.statementImport)
        .where(
          and(
            eq(schema.statementImport.workspaceId, workspaceId),
            eq(schema.statementImport.fileHash, fileHash),
          ),
        )
        .limit(1)
        .then((r) => r[0]);

      if (existing) {
        return {
          imported: 0,
          duplicates: 0,
          total: 0,
          alreadyImported: true,
          previousImportAt: existing.createdAt.toISOString(),
        };
      }
    }

    const {
      transactions: parsed,
      accountInfo,
      period,
      ledgerBalance,
    } = this.ofxParser.parse(buffer);

    let accountCreated = false;
    let resolvedAccountId = bankAccountId;

    if (!resolvedAccountId) {
      const name = accountInfo?.name ?? 'Conta Importada';
      const type = accountInfo?.type ?? 'checking';

      const existing = await this.db
        .select({ id: schema.bankAccount.id })
        .from(schema.bankAccount)
        .where(
          and(
            eq(schema.bankAccount.workspaceId, workspaceId),
            eq(schema.bankAccount.name, name),
          ),
        )
        .limit(1)
        .then((r) => r[0]);

      if (existing) {
        resolvedAccountId = existing.id;
      } else {
        const created = await this.bankAccountRepository.create({
          workspaceId,
          name,
          type,
          balance: 0,
          color: '#6366f1',
        });
        resolvedAccountId = created.id;
        accountCreated = true;
      }
    } else {
      const account = await this.bankAccountRepository.findById(resolvedAccountId, workspaceId);
      if (!account) throw new NotFoundException('Conta bancária não encontrada');
    }

    if (parsed.length === 0) return { imported: 0, duplicates: 0, total: 0, accountCreated };

    // Período do extrato: usa o informado pelo banco (BANKTRANLIST), com
    // fallback para o intervalo das próprias transações.
    const parsedDates = parsed.map((t) => t.date).sort();
    const periodStart = period?.start ?? parsedDates[0];
    const periodEnd = period?.end ?? parsedDates[parsedDates.length - 1];

    // Importação retroativa: extrato cujo período termina antes de tudo que
    // já existe na conta. Um ajuste feito num extrato anterior pode ter
    // coberto, às cegas, o saldo que ESTE extrato agora explica de verdade —
    // alertamos em vez de deixar contar em dobro silenciosamente.
    let possibleRedundantAdjustments: NonNullable<ImportResult['possibleRedundantAdjustments']> = [];
    const earliestExistingDate =
      await this.transactionRepository.findEarliestDateByBankAccount(resolvedAccountId);

    if (earliestExistingDate && periodEnd < earliestExistingDate) {
      // Janela: do fim deste extrato até o fim do próximo extrato já
      // importado (o que, na época, pode ter recebido o ajuste em questão).
      const nextImport = await this.db
        .select({ periodEnd: schema.statementImport.periodEnd })
        .from(schema.statementImport)
        .where(
          and(
            eq(schema.statementImport.bankAccountId, resolvedAccountId),
            gt(schema.statementImport.periodStart, periodEnd),
          ),
        )
        .orderBy(schema.statementImport.periodStart)
        .limit(1)
        .then((r) => r[0]);

      const windowEnd = nextImport?.periodEnd ?? earliestExistingDate;
      const candidates = await this.transactionRepository.findByBankAccountInDateRange(
        resolvedAccountId,
        periodEnd,
        windowEnd,
      );
      possibleRedundantAdjustments = candidates
        .filter((t) => t.category === 'adjustment')
        .map((t) => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          type: t.type,
          description: t.description,
        }));
    }

    // Deduplicação em duas camadas: 1) FITID exato.
    const fitIds = parsed.map((t) => t.fitId);
    const existingFitIds = await this.transactionRepository.findExternalIdsByBankAccount(
      resolvedAccountId,
      fitIds,
    );
    const existingFitIdSet = new Set(existingFitIds);

    // 2) Fallback por (data, valor, tipo) — cobre bancos que reemitem FITIDs
    // e lançamentos manuais que já representam a mesma movimentação.
    const existingInPeriod = await this.transactionRepository.findByBankAccountInDateRange(
      resolvedAccountId,
      periodStart,
      periodEnd,
    );
    const fuzzyPool = new Map<string, number>();
    for (const tx of existingInPeriod) {
      const key = fuzzyKey(tx);
      fuzzyPool.set(key, (fuzzyPool.get(key) ?? 0) + 1);
    }

    let newTransactions: OFXTransaction[] = [];
    let duplicates = 0;

    for (const t of parsed) {
      if (existingFitIdSet.has(t.fitId)) {
        duplicates++;
        continue;
      }

      const key = fuzzyKey({ date: t.date, amount: t.amountInCents, type: t.type });
      const remaining = fuzzyPool.get(key) ?? 0;
      if (remaining > 0) {
        fuzzyPool.set(key, remaining - 1);
        duplicates++;
        continue;
      }

      newTransactions.push(t);
    }

    if (newTransactions.length === 0) {
      return {
        imported: 0,
        duplicates,
        total: parsed.length,
        accountCreated,
        periodStart,
        periodEnd,
        reconciled: true,
        possibleRedundantAdjustments: possibleRedundantAdjustments.length
          ? possibleRedundantAdjustments
          : undefined,
      };
    }

    // Verifica limite do plano Free
    const now = new Date();
    const currentCount =
      await this.transactionRepository.countByWorkspaceAndMonth(
        workspaceId,
        now.getFullYear(),
        now.getMonth() + 1,
      );

    /* if (currentCount >= FREE_PLAN_TRANSACTION_LIMIT) {
      throw new ForbiddenException(
        'Limite de transações do plano atingido. Faça upgrade para continuar.',
      );
    } */

    // Importa apenas até o limite restante
    const remaining = FREE_PLAN_TRANSACTION_LIMIT - currentCount;
    if (newTransactions.length > remaining) {
      newTransactions = newTransactions.slice(0, remaining);
    }

    // Conciliação: quando o banco informa o saldo final (LEDGERBAL), valida
    // "saldo anterior + entradas - saídas" contra ele ANTES de persistir
    // qualquer coisa. O saldo do banco nunca é somado ao saldo da conta.
    let calculatedBalance: number | undefined;
    let bankBalance: number | undefined;
    let divergence: number | undefined;
    let reconciled = true;

    if (ledgerBalance) {
      const balanceBeforeImport =
        await this.transactionRepository.sumBalanceByBankAccountUpToDate(
          resolvedAccountId,
          periodEnd,
        );
      const newDeltaUpToPeriodEnd = newTransactions
        .filter((t) => t.date <= periodEnd)
        .reduce(
          (sum, t) => sum + (t.type === 'income' ? t.amountInCents : -t.amountInCents),
          0,
        );

      calculatedBalance = balanceBeforeImport + newDeltaUpToPeriodEnd;
      bankBalance = ledgerBalance.amountInCents;
      divergence = calculatedBalance - bankBalance;
      reconciled = divergence === 0;

      if (!reconciled && !force && !adjustToBankBalance) {
        return {
          imported: 0,
          duplicates,
          total: parsed.length,
          accountCreated,
          periodStart,
          periodEnd,
          calculatedBalance,
          bankBalance,
          divergence,
          reconciled: false,
          requiresConfirmation: true,
          possibleRedundantAdjustments: possibleRedundantAdjustments.length
            ? possibleRedundantAdjustments
            : undefined,
        };
      }
    }

    const shouldAdjust = adjustToBankBalance && !!divergence && divergence !== 0;

    // Insere em lote dentro de uma única transação de banco
    await this.db.transaction(async (trx) => {
      let totalDelta = 0;

      for (const t of newTransactions) {
        await this.transactionRepository.create(
          {
            workspaceId,
            bankAccountId: resolvedAccountId,
            amount: t.amountInCents,
            type: t.type,
            description: t.description,
            category: this.categoryInference.infer(t.description, t.type),
            date: t.date,
            externalId: t.fitId,
          },
          trx,
        );
        totalDelta += t.type === 'income' ? t.amountInCents : -t.amountInCents;
      }

      if (shouldAdjust && divergence !== undefined) {
        // divergence < 0: faltam entradas. divergence > 0: sobram saídas.
        const adjustmentAmount = Math.abs(divergence);
        const adjustmentType: 'income' | 'expense' = divergence < 0 ? 'income' : 'expense';
        await this.transactionRepository.create(
          {
            workspaceId,
            bankAccountId: resolvedAccountId,
            amount: adjustmentAmount,
            type: adjustmentType,
            description: 'Ajuste de conciliação (diferença com o extrato bancário)',
            category: 'adjustment',
            date: ledgerBalance?.asOf ?? periodEnd,
            externalId: null,
          },
          trx,
        );
        totalDelta += adjustmentType === 'income' ? adjustmentAmount : -adjustmentAmount;
      }

      if (totalDelta !== 0) {
        await this.bankAccountRepository.updateBalance(
          resolvedAccountId,
          totalDelta,
          trx,
        );
      }

      // Registra até quando o saldo está confirmado por extrato (LEDGERBAL
      // ou fim do período), para a UI avisar quando não é o saldo "de hoje".
      await this.bankAccountRepository.advanceBalanceAsOf(
        resolvedAccountId,
        ledgerBalance?.asOf ?? periodEnd,
        trx,
      );
    });

    // Se o ajuste foi aplicado, a diferença original foi coberta por uma
    // transação explícita — o saldo agora concilia com o banco.
    if (shouldAdjust) {
      reconciled = true;
    }

    await this.db.insert(schema.statementImport).values({
      workspaceId,
      bankAccountId: resolvedAccountId,
      fileHash,
      filename: filename ?? null,
      imported: newTransactions.length,
      duplicates,
      total: parsed.length,
      periodStart,
      periodEnd,
      bankBalance: bankBalance ?? null,
      bankBalanceAsOf: ledgerBalance?.asOf ?? null,
      calculatedBalance: calculatedBalance ?? null,
      divergence: divergence ?? null,
      reconciled,
    });

    return {
      imported: newTransactions.length,
      duplicates,
      total: parsed.length,
      accountCreated,
      accountName: accountCreated ? (accountInfo?.name ?? 'Conta Importada') : undefined,
      periodStart,
      periodEnd,
      calculatedBalance,
      bankBalance,
      divergence,
      reconciled,
      adjusted: shouldAdjust,
      possibleRedundantAdjustments: possibleRedundantAdjustments.length
        ? possibleRedundantAdjustments
        : undefined,
    };
  }
}
