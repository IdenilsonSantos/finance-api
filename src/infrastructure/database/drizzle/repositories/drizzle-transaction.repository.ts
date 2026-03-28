import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, count, inArray, isNotNull, ilike, or, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { TransactionEntity } from '../../../../core/entities/transaction.entity';
import { ITransactionRepository, ListTransactionsFilters } from '../../../../core/repositories/transaction.repository.interface';
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
    const { page, limit, type, category, accountId, startDate, endDate, search } = filters;
    const { limit: lim, offset } = paginate(page, limit);

    const conditions: SQL[] = [eq(schema.transaction.workspaceId, workspaceId)];

    if (type) conditions.push(eq(schema.transaction.type, type));
    if (category) conditions.push(eq(schema.transaction.category, category));
    if (accountId) conditions.push(eq(schema.transaction.bankAccountId, accountId));
    if (startDate) conditions.push(gte(schema.transaction.date, startDate));
    if (endDate) conditions.push(lte(schema.transaction.date, endDate));
    if (search) {
      conditions.push(
        or(
          ilike(schema.transaction.description, `%${search}%`),
          ilike(schema.transaction.beneficiary, `%${search}%`),
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
      .orderBy(schema.transaction.date, schema.transaction.createdAt)
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

  async countByWorkspaceAndMonth(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<number> {
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);

    const [result] = await this.db
      .select({ count: count() })
      .from(schema.transaction)
      .where(
        and(
          eq(schema.transaction.workspaceId, workspaceId),
          gte(schema.transaction.date, start),
          lte(schema.transaction.date, end),
        ),
      );

    return Number(result?.count ?? 0);
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
    return results.map((r) => r.externalId!);
  }
}
