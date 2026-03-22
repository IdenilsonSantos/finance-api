import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lte, gte } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { ScheduledTransactionEntity } from '../../../../core/entities/scheduled-transaction.entity';
import { IScheduledTransactionRepository } from '../../../../core/repositories/scheduled-transaction.repository.interface';

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

  async findAllByWorkspace(workspaceId: string): Promise<ScheduledTransactionEntity[]> {
    const today = new Date().toISOString().slice(0, 10);
    const results = await this.db
      .select()
      .from(schema.scheduledTransaction)
      .where(
        and(
          eq(schema.scheduledTransaction.workspaceId, workspaceId),
          gte(schema.scheduledTransaction.nextDate, today),
        ),
      )
      .orderBy(schema.scheduledTransaction.nextDate);
    return results.map((r) => new ScheduledTransactionEntity(r));
  }

  async findDue(upToDate: string): Promise<ScheduledTransactionEntity[]> {
    const results = await this.db.query.scheduledTransaction.findMany({
      where: lte(schema.scheduledTransaction.nextDate, upToDate),
    });
    return results.map((r) => new ScheduledTransactionEntity(r));
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
