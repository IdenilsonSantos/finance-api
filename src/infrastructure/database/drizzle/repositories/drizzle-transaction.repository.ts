import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, lt, count, inArray, isNotNull, ilike, or, sql, SQL, asc, desc, notInArray } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { TransactionEntity, NON_FLOW_CATEGORIES } from '../../../../core/entities/transaction.entity';
import {
  ITransactionRepository,
  ListTransactionsFilters,
  TransactionsSummary,
  TransactionsSummaryFilters,
} from '../../../../core/repositories/transaction.repository.interface';
import { PaginatedResult } from '../../../../core/dto/pagination.dto';
import { paginate } from '../helpers/paginate.helper';

@Injectable()
export class DrizzleTransactionRepository implements ITransactionRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string, workspaceId: string): Promise<TransactionEntity | null> {
    const result = await this.db.query.transaction.findFirst({
      where: and(
        eq(schema.transaction.id, id),
        eq(schema.transaction.workspaceId, workspaceId),
      ),
    });
    return result ? new TransactionEntity(result) : null;
  }

  async findAllByWorkspace(
    workspaceId: string,
    filters: ListTransactionsFilters,
  ): Promise<PaginatedResult<TransactionEntity>> {
    const { page, limit, type, category, accountId, startDate, endDate, search, status, order } = filters;
    const { limit: lim, offset } = paginate(page, limit);

    const conditions: SQL[] = [eq(schema.transaction.workspaceId, workspaceId)];

    if (type) conditions.push(eq(schema.transaction.type, type));
    if (status) conditions.push(eq(schema.transaction.status, status));
    if (category) conditions.push(eq(schema.transaction.category, category));
    if (accountId) conditions.push(eq(schema.transaction.bankAccountId, accountId));
    if (startDate) conditions.push(gte(schema.transaction.date, startDate));
    if (endDate) conditions.push(lte(schema.transaction.date, endDate));
    if (search) {
      // Escapa curingas do LIKE para que "%" e "_" digitados sejam literais.
      const pattern = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(
        or(
          ilike(schema.transaction.description, pattern),
          ilike(schema.transaction.beneficiary, pattern),
        ) as SQL,
      );
    }

    const where = and(...conditions);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.transaction)
      .where(where);

    const rows = await this.db
      .select()
      .from(schema.transaction)
      .where(where)
      // Extrato: mais recentes primeiro.
      .orderBy(
        ...(order === 'asc'
          ? [asc(schema.transaction.date), asc(schema.transaction.createdAt)]
          : [desc(schema.transaction.date), desc(schema.transaction.createdAt)]),
      )
      .limit(lim)
      .offset(offset);

    const totalNum = Number(total);

    return {
      data: rows.map((r) => new TransactionEntity(r)),
      total: totalNum,
      page,
      limit,
      totalPages: Math.ceil(totalNum / limit),
    };
  }

  async findByInstallmentGroup(groupId: string, workspaceId: string): Promise<TransactionEntity[]> {
    const rows = await this.db
      .select()
      .from(schema.transaction)
      .where(
        and(
          eq(schema.transaction.installmentGroupId, groupId),
          eq(schema.transaction.workspaceId, workspaceId),
        ),
      )
      .orderBy(schema.transaction.installmentNumber);
    return rows.map((r) => new TransactionEntity(r));
  }

  async summarize(
    workspaceId: string,
    filters: TransactionsSummaryFilters,
  ): Promise<TransactionsSummary> {
    const conditions: SQL[] = [eq(schema.transaction.workspaceId, workspaceId)];
    if (filters.accountId) conditions.push(eq(schema.transaction.bankAccountId, filters.accountId));
    if (filters.startDate) conditions.push(gte(schema.transaction.date, filters.startDate));
    if (filters.endDate) conditions.push(lte(schema.transaction.date, filters.endDate));
    const where = and(...conditions);

    const t = schema.transaction;
    const [totals] = await this.db
      .select({
        income: sql<string>`coalesce(sum(${t.amount}) filter (where ${t.type} = 'income' and ${t.status} = 'paid'), 0)`,
        expense: sql<string>`coalesce(sum(${t.amount}) filter (where ${t.type} = 'expense' and ${t.status} = 'paid'), 0)`,
        incomeCount: sql<string>`count(*) filter (where ${t.type} = 'income' and ${t.status} = 'paid')`,
        expenseCount: sql<string>`count(*) filter (where ${t.type} = 'expense' and ${t.status} = 'paid')`,
        pendingIncome: sql<string>`coalesce(sum(${t.amount}) filter (where ${t.type} = 'income' and ${t.status} = 'pending'), 0)`,
        pendingExpense: sql<string>`coalesce(sum(${t.amount}) filter (where ${t.type} = 'expense' and ${t.status} = 'pending'), 0)`,
        pendingCount: sql<string>`count(*) filter (where ${t.status} = 'pending')`,
      })
      .from(schema.transaction)
      .where(and(where, notInArray(schema.transaction.category, NON_FLOW_CATEGORIES)));

    // Atrasadas: todas as pendências vencidas, de qualquer período (uma conta
    // de meses atrás continua atrasada mesmo olhando o mês atual).
    const overdueConditions: SQL[] = [
      eq(t.workspaceId, workspaceId),
      eq(t.status, 'pending'),
      lt(t.date, filters.today),
    ];
    if (filters.accountId) overdueConditions.push(eq(t.bankAccountId, filters.accountId));
    const [overdue] = await this.db
      .select({ n: count() })
      .from(schema.transaction)
      .where(and(...overdueConditions));

    const dates = await this.db
      .selectDistinct({ date: schema.transaction.date })
      .from(schema.transaction)
      .where(where)
      .orderBy(schema.transaction.date);

    const income = Number(totals?.income ?? 0);
    const expense = Number(totals?.expense ?? 0);

    return {
      income,
      expense,
      balance: income - expense,
      incomeCount: Number(totals?.incomeCount ?? 0),
      expenseCount: Number(totals?.expenseCount ?? 0),
      pendingIncome: Number(totals?.pendingIncome ?? 0),
      pendingExpense: Number(totals?.pendingExpense ?? 0),
      pendingCount: Number(totals?.pendingCount ?? 0),
      overdueCount: Number(overdue?.n ?? 0),
      activeDates: dates.map((d) => d.date),
    };
  }

  async create(data: Partial<TransactionEntity>, trx?: any): Promise<TransactionEntity> {
    const db = trx || this.db;
    const [result] = await db
      .insert(schema.transaction)
      .values(data as typeof schema.transaction.$inferInsert)
      .returning();
    return new TransactionEntity(result);
  }

  async update(id: string, workspaceId: string, data: Partial<TransactionEntity>, trx?: any): Promise<TransactionEntity> {
    const db = trx || this.db;
    const [result] = await db
      .update(schema.transaction)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.transaction.id, id),
          eq(schema.transaction.workspaceId, workspaceId),
        ),
      )
      .returning();
    return new TransactionEntity(result);
  }

  async delete(id: string, workspaceId: string, trx?: any): Promise<void> {
    const db = trx || this.db;
    await db
      .delete(schema.transaction)
      .where(
        and(
          eq(schema.transaction.id, id),
          eq(schema.transaction.workspaceId, workspaceId),
        ),
      );
  }

  async findExternalIdsByBankAccount(
    bankAccountId: string,
    fitIds: string[],
  ): Promise<string[]> {
    if (fitIds.length === 0) return [];
    const results = await this.db
      .select({ externalId: schema.transaction.externalId })
      .from(schema.transaction)
      .where(
        and(
          eq(schema.transaction.bankAccountId, bankAccountId),
          isNotNull(schema.transaction.externalId),
          inArray(schema.transaction.externalId, fitIds),
        ),
      );
    // Aplicações/resgates importados viram transferências: o FITID fica nelas.
    const transfers = await this.db
      .select({ externalId: schema.transfer.externalId })
      .from(schema.transfer)
      .where(
        and(
          or(
            eq(schema.transfer.fromAccountId, bankAccountId),
            eq(schema.transfer.toAccountId, bankAccountId),
          ),
          isNotNull(schema.transfer.externalId),
          inArray(schema.transfer.externalId, fitIds),
        ),
      );
    return [...results, ...transfers].map((r) => r.externalId!);
  }

  async findByBankAccountInDateRange(
    bankAccountId: string,
    startDate: string,
    endDate: string,
  ): Promise<TransactionEntity[]> {
    const rows = await this.db
      .select()
      .from(schema.transaction)
      .where(
        and(
          eq(schema.transaction.bankAccountId, bankAccountId),
          gte(schema.transaction.date, startDate),
          lte(schema.transaction.date, endDate),
        ),
      );
    return rows.map((r) => new TransactionEntity(r));
  }

  async sumBalanceByBankAccountUpToDate(
    bankAccountId: string,
    asOfDate: string,
  ): Promise<number> {
    const [txResult] = await this.db
      .select({
        balance: sql<string>`coalesce(sum(case when ${schema.transaction.type} = 'income' then ${schema.transaction.amount} else -${schema.transaction.amount} end), 0)`,
      })
      .from(schema.transaction)
      .where(
        and(
          eq(schema.transaction.bankAccountId, bankAccountId),
          eq(schema.transaction.status, 'paid'),
          lte(schema.transaction.date, asOfDate),
        ),
      );

    // Transferências também movimentam o saldo armazenado da conta; sem elas
    // o saldo reconstruído divergiria do real em toda conta que já transferiu.
    const [transferResult] = await this.db
      .select({
        balance: sql<string>`coalesce(sum(case when ${schema.transfer.toAccountId} = ${bankAccountId} then ${schema.transfer.amount} else -${schema.transfer.amount} end), 0)`,
      })
      .from(schema.transfer)
      .where(
        and(
          or(
            eq(schema.transfer.fromAccountId, bankAccountId),
            eq(schema.transfer.toAccountId, bankAccountId),
          ),
          lte(schema.transfer.date, asOfDate),
        ),
      );

    return Number(txResult?.balance ?? 0) + Number(transferResult?.balance ?? 0);
  }

  async findEarliestDateByBankAccount(bankAccountId: string): Promise<string | null> {
    const [result] = await this.db
      .select({ date: schema.transaction.date })
      .from(schema.transaction)
      .where(eq(schema.transaction.bankAccountId, bankAccountId))
      .orderBy(schema.transaction.date)
      .limit(1);
    return result?.date ?? null;
  }
}
