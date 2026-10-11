import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lte, isNull, or, count, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { ScheduledTransactionEntity } from '../../../../core/entities/scheduled-transaction.entity';
import { IScheduledTransactionRepository, ListScheduledTransactionsFilters } from '../../../../core/repositories/scheduled-transaction.repository.interface';
import { PaginatedResult } from '../../../../core/dto/pagination.dto';
import { paginate } from '../helpers/paginate.helper';

@Injectable()
export class DrizzleScheduledTransactionRepository
  implements IScheduledTransactionRepository
{
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<ScheduledTransactionEntity | null> {
    const result = await this.db.query.scheduledTransaction.findFirst({
      where: and(
        eq(schema.scheduledTransaction.id, id),
        eq(schema.scheduledTransaction.workspaceId, workspaceId),
      ),
    });
    return result ? new ScheduledTransactionEntity(result) : null;
  }

  async findAllByWorkspace(
    workspaceId: string,
    filters: ListScheduledTransactionsFilters,
  ): Promise<PaginatedResult<ScheduledTransactionEntity>> {
    const { page, limit, frequency, accountId } = filters;
    const { limit: lim, offset } = paginate(page, limit);
    // Inclui ocorrências vencidas ainda não executadas (aparecem como
    // "atrasadas" no app), mas não recorrências já encerradas.
    const conditions: SQL[] = [
      eq(schema.scheduledTransaction.workspaceId, workspaceId),
      or(
        isNull(schema.scheduledTransaction.endDate),
        lte(schema.scheduledTransaction.nextDate, schema.scheduledTransaction.endDate),
      ) as SQL,
    ];

    if (frequency) conditions.push(eq(schema.scheduledTransaction.frequency, frequency));
    if (accountId) conditions.push(eq(schema.scheduledTransaction.bankAccountId, accountId));

    const where = and(...conditions);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.scheduledTransaction)
      .where(where);

    const rows = await this.db
      .select()
      .from(schema.scheduledTransaction)
      .where(where)
      .orderBy(schema.scheduledTransaction.nextDate)
      .limit(lim)
      .offset(offset);

    const totalNum = Number(total);

    return {
      data: rows.map((r) => new ScheduledTransactionEntity(r)),
      total: totalNum,
      page,
      limit,
      totalPages: Math.ceil(totalNum / limit),
    };
  }

  async findDue(upToDate: string): Promise<ScheduledTransactionEntity[]> {
    const results = await this.db
      .select()
      .from(schema.scheduledTransaction)
      .where(
        and(
          lte(schema.scheduledTransaction.nextDate, upToDate),
          // Compara com a própria ocorrência (não com hoje) para que
          // ocorrências atrasadas anteriores ao término ainda sejam executadas.
          or(
            isNull(schema.scheduledTransaction.endDate),
            lte(schema.scheduledTransaction.nextDate, schema.scheduledTransaction.endDate),
          ),
        ),
      );
    return results.map((r) => new ScheduledTransactionEntity(r));
  }

  async claimOccurrence(
    id: string,
    expectedNextDate: string,
    newNextDate: string | null,
    trx: any,
  ): Promise<boolean> {
    const where = and(
      eq(schema.scheduledTransaction.id, id),
      eq(schema.scheduledTransaction.nextDate, expectedNextDate),
    );
    const rows = newNextDate
      ? await trx
          .update(schema.scheduledTransaction)
          .set({ nextDate: newNextDate, updatedAt: new Date() })
          .where(where)
          .returning({ id: schema.scheduledTransaction.id })
      : await trx
          .delete(schema.scheduledTransaction)
          .where(where)
          .returning({ id: schema.scheduledTransaction.id });
    return rows.length > 0;
  }

  async create(
    data: Partial<ScheduledTransactionEntity>,
    trx?: any,
  ): Promise<ScheduledTransactionEntity> {
    const db = trx || this.db;
    const [result] = await db
      .insert(schema.scheduledTransaction)
      .values(data as typeof schema.scheduledTransaction.$inferInsert)
      .returning();
    return new ScheduledTransactionEntity(result);
  }

  async update(
    id: string,
    workspaceId: string,
    data: Partial<ScheduledTransactionEntity>,
    trx?: any,
  ): Promise<ScheduledTransactionEntity> {
    const db = trx || this.db;
    const [result] = await db
      .update(schema.scheduledTransaction)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.scheduledTransaction.id, id),
          eq(schema.scheduledTransaction.workspaceId, workspaceId),
        ),
      )
      .returning();
    return new ScheduledTransactionEntity(result);
  }

  async delete(id: string, workspaceId: string, trx?: any): Promise<void> {
    const db = trx || this.db;
    await db
      .delete(schema.scheduledTransaction)
      .where(
        and(
          eq(schema.scheduledTransaction.id, id),
          eq(schema.scheduledTransaction.workspaceId, workspaceId),
        ),
      );
  }
}
