import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, count } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { TransactionEntity } from '../../../../core/entities/transaction.entity';
import { ITransactionRepository } from '../../../../core/repositories/transaction.repository.interface';

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

  async findAllByWorkspace(workspaceId: string): Promise<TransactionEntity[]> {
    const results = await this.db.query.transaction.findMany({
      where: eq(schema.transaction.workspaceId, workspaceId),
      orderBy: (t, { desc }) => [desc(t.date), desc(t.createdAt)],
    });
    return results.map((r) => new TransactionEntity(r));
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
}
