import {
  Injectable,
  Inject,
  NotFoundException,
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
import { TransactionEntity, balanceEffect } from '../../core/entities/transaction.entity';
import { assertAccountActive } from '../../core/utils/accounts';
import { classifyInvestmentMovement } from '../../core/utils/investments';
import { isCardBillPayment, pickCardForPayment } from '../../core/utils/card-payments';
import { ITransferRepository } from '../../core/repositories/transfer.repository.interface';
import { InvestmentAccountsService } from './investment-accounts.service';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { parseISODate, toISODate } from '../../core/utils/date';

/**
 * Tolerância (dias) para reconhecer no extrato uma conta pendente paga antes
 * ou depois da data cadastrada (ex.: boleto pago com atraso).
 */
const PENDING_MATCH_WINDOW_DAYS = 5;


export interface ImportResult {
  imported: number;
  duplicates: number;
  /** Contas pendentes que apareceram pagas no extrato e foram efetivadas. */
  settled?: number;
  /** Aplicações/resgates registrados como transferência (não como despesa/receita). */
  investmentTransfers?: number;
  /** Conta de investimento que recebeu as aplicações/resgates. */
  investmentAccountName?: string;
  /** Pagamentos de fatura registrados como transferência para o cartão. */
  cardPayments?: number;
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
    private readonly investmentAccounts: InvestmentAccountsService,
    @Inject(ITransferRepository)
    private readonly transferRepository: ITransferRepository,
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
        .select({ id: schema.bankAccount.id, name: schema.bankAccount.name, archivedAt: schema.bankAccount.archivedAt })
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
        if (existing.archivedAt) assertAccountActive(existing);
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
      assertAccountActive(account);
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
      toISODate(addDays(parseISODate(periodStart), -PENDING_MATCH_WINDOW_DAYS)),
      toISODate(addDays(parseISODate(periodEnd), PENDING_MATCH_WINDOW_DAYS)),
    );
    // Pagas primeiro: uma linha do extrato só "consome" uma conta pendente
    // quando não há lançamento já efetivado equivalente.
    const fuzzyPool = new Map<string, TransactionEntity[]>();
    for (const tx of [...existingInPeriod].sort(
      (a, b) => Number(a.status === 'pending') - Number(b.status === 'pending'),
    )) {
      const key = fuzzyKey(tx);
      fuzzyPool.set(key, [...(fuzzyPool.get(key) ?? []), tx]);
    }

    const newTransactions: OFXTransaction[] = [];
    // Contas pendentes que o extrato mostra como pagas: são efetivadas (e
    // passam a contar no saldo) em vez de virar duplicata descartada.
    const toSettle: { tx: TransactionEntity; fitId: string; date: string }[] = [];
    const consumed = new Set<string>();
    let duplicates = 0;

    // 3) Conta pendente de mesmo valor e tipo paga alguns dias antes/depois:
    // escolhe a de data mais próxima dentro da tolerância.
    const nearestPending = (t: OFXTransaction): TransactionEntity | undefined => {
      let best: { tx: TransactionEntity; distance: number } | undefined;
      for (const tx of existingInPeriod) {
        if (tx.status !== 'pending' || consumed.has(tx.id)) continue;
        if (tx.amount !== t.amountInCents || tx.type !== t.type) continue;
        const distance = Math.abs(differenceInCalendarDays(parseISODate(tx.date), parseISODate(t.date)));
        if (distance > PENDING_MATCH_WINDOW_DAYS) continue;
        if (!best || distance < best.distance) best = { tx, distance };
      }
      return best?.tx;
    };

    for (const t of parsed) {
      if (existingFitIdSet.has(t.fitId)) {
        duplicates++;
        continue;
      }

      const key = fuzzyKey({ date: t.date, amount: t.amountInCents, type: t.type });
      let match = fuzzyPool.get(key)?.shift();
      while (match && consumed.has(match.id)) match = fuzzyPool.get(key)?.shift();
      if (match) {
        consumed.add(match.id);
        if (match.status === 'pending') toSettle.push({ tx: match, fitId: t.fitId, date: t.date });
        else duplicates++;
        continue;
      }

      const pending = nearestPending(t);
      if (pending) {
        consumed.add(pending.id);
        toSettle.push({ tx: pending, fitId: t.fitId, date: t.date });
        continue;
      }

      newTransactions.push(t);
    }

    if (newTransactions.length === 0 && toSettle.length === 0) {
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
      const newDeltaUpToPeriodEnd =
        newTransactions
          .filter((t) => t.date <= periodEnd)
          .reduce(
            (sum, t) => sum + (t.type === 'income' ? t.amountInCents : -t.amountInCents),
            0,
          ) +
        toSettle
          .filter(({ date }) => date <= periodEnd)
          .reduce((sum, { tx }) => sum + balanceEffect({ ...tx, status: 'paid' }), 0);

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

    // Aplicações e resgates de investimento viram transferências para a conta
    // de investimento vinculada (não são despesa/receita). Cartão não tem.
    const sourceAccount = await this.bankAccountRepository.findById(resolvedAccountId, workspaceId);
    const movements = new Map(
      sourceAccount && sourceAccount.type !== 'credit_card'
        ? newTransactions
            .map((t) => [t.fitId, classifyInvestmentMovement(t.description, t.type)] as const)
            .filter(([, kind]) => kind !== null)
        : [],
    );
    let investmentAccountName: string | undefined;

    // Pagamentos de fatura viram transferências para o cartão (quando ele está
    // cadastrado e dá para identificá-lo); as compras do cartão é que são despesa.
    const workspaceAccounts =
      sourceAccount && sourceAccount.type !== 'credit_card'
        ? await this.bankAccountRepository.findAllByWorkspace(workspaceId)
        : [];
    const cardPayments = new Map<string, { id: string }>();
    for (const t of newTransactions) {
      if (!sourceAccount || movements.has(t.fitId) || !isCardBillPayment(t.description, t.type)) continue;
      const card = pickCardForPayment(workspaceAccounts, sourceAccount.name, t.description);
      if (card) cardPayments.set(t.fitId, card);
    }

    // Insere em lote dentro de uma única transação de banco
    await this.db.transaction(async (trx) => {
      let totalDelta = 0;
      let investmentDelta = 0;
      const investment =
        movements.size > 0 && sourceAccount
          ? await this.investmentAccounts.findOrCreate(sourceAccount, trx)
          : null;
      investmentAccountName = investment?.name;

      const cardDeltas = new Map<string, number>();

      for (const t of newTransactions) {
        const card = cardPayments.get(t.fitId);
        if (card) {
          await this.transferRepository.create(
            {
              workspaceId,
              fromAccountId: resolvedAccountId,
              toAccountId: card.id,
              amount: t.amountInCents,
              description: t.description,
              date: t.date,
              externalId: t.fitId,
            },
            trx,
          );
          totalDelta -= t.amountInCents;
          cardDeltas.set(card.id, (cardDeltas.get(card.id) ?? 0) + t.amountInCents);
          continue;
        }

        if (investment && movements.has(t.fitId)) {
          const isDeposit = movements.get(t.fitId) === 'deposit';
          await this.transferRepository.create(
            {
              workspaceId,
              fromAccountId: isDeposit ? resolvedAccountId : investment.id,
              toAccountId: isDeposit ? investment.id : resolvedAccountId,
              amount: t.amountInCents,
              description: t.description,
              date: t.date,
              externalId: t.fitId,
            },
            trx,
          );
          totalDelta += isDeposit ? -t.amountInCents : t.amountInCents;
          investmentDelta += isDeposit ? t.amountInCents : -t.amountInCents;
          continue;
        }

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

      if (investment && investmentDelta !== 0) {
        await this.bankAccountRepository.updateBalance(investment.id, investmentDelta, trx);
      }
      for (const [cardId, delta] of cardDeltas) {
        await this.bankAccountRepository.updateBalance(cardId, delta, trx);
      }

      for (const { tx, fitId, date } of toSettle) {
        // A data passa a ser a do pagamento informada pelo banco.
        await this.transactionRepository.update(
          tx.id,
          workspaceId,
          { status: 'paid', externalId: fitId, date },
          trx,
        );
        totalDelta += balanceEffect({ ...tx, status: 'paid' });
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
      settled: toSettle.length,
      investmentTransfers: investmentAccountName ? movements.size : 0,
      investmentAccountName,
      cardPayments: cardPayments.size,
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
