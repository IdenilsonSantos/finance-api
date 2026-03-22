import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { OFXParserService } from './ofx-parser.service';
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

    const { transactions: parsed, accountInfo } = this.ofxParser.parse(buffer);

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

    // Deduplicação: busca FITIDs que já existem no banco
    const fitIds = parsed.map((t) => t.fitId);
    const existingFitIds = await this.transactionRepository.findExternalIdsByBankAccount(
      resolvedAccountId,
      fitIds,
    );
    const existingSet = new Set(existingFitIds);

    let newTransactions = parsed.filter((t) => !existingSet.has(t.fitId));
    const duplicates = parsed.length - newTransactions.length;

    if (newTransactions.length === 0) {
      return { imported: 0, duplicates, total: parsed.length, accountCreated };
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

      if (totalDelta !== 0) {
        await this.bankAccountRepository.updateBalance(
          resolvedAccountId,
          totalDelta,
          trx,
        );
      }
    });

    await this.db.insert(schema.statementImport).values({
      workspaceId,
      bankAccountId: resolvedAccountId,
      fileHash,
      filename: filename ?? null,
      imported: newTransactions.length,
      duplicates,
      total: parsed.length,
    });

    return {
      imported: newTransactions.length,
      duplicates,
      total: parsed.length,
      accountCreated,
      accountName: accountCreated ? (accountInfo?.name ?? 'Conta Importada') : undefined,
    };
  }
}
