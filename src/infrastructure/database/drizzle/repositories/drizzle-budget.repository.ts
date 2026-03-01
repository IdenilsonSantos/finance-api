import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, sum } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { BudgetEntity, BudgetSummaryItem } from '../../../../core/entities/budget.entity';
import { IBudgetRepository } from '../../../../core/repositories/budget.repository.interface';

@Injectable()
export class DrizzleBudgetRepository implements IBudgetRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string, workspaceId: string): Promise<BudgetEntity | null> {
    const result = await this.db.query.budget.findFirst({
      where: and(
        eq(schema.budget.id, id),
        eq(schema.budget.workspaceId, workspaceId),
      ),
    });
    return result ? new BudgetEntity(result) : null;
  }

  async findAllByWorkspace(workspaceId: string, month?: string): Promise<BudgetEntity[]> {
    const results = await this.db.query.budget.findMany({
      where: and(
        eq(schema.budget.workspaceId, workspaceId),
        month ? eq(schema.budget.month, month) : undefined,
      ),
      orderBy: (b, { asc }) => [asc(b.category)],
    });
    return results.map((r) => new BudgetEntity(r));
  }

  async getSummary(workspaceId: string, month: string): Promise<BudgetSummaryItem[]> {
    const [year, mm] = month.split('-').map(Number);
    const startDate = `${month}-01`;
    const endDate = new Date(year, mm, 0).toISOString().slice(0, 10);

    const budgets = await this.db.query.budget.findMany({
      where: and(
        eq(schema.budget.workspaceId, workspaceId),
        eq(schema.budget.month, month),
      ),
      orderBy: (b, { asc }) => [asc(b.category)],
    });

    const spending = await this.db
      .select({
        category: schema.transaction.category,
        spent: sum(schema.transaction.amount),
      })
      .from(schema.transaction)
      .where(
        and(
          eq(schema.transaction.workspaceId, workspaceId),
          eq(schema.transaction.type, 'expense'),
          gte(schema.transaction.date, startDate),
          lte(schema.transaction.date, endDate),
        ),
      )
      .groupBy(schema.transaction.category);

    return budgets.map((b) => {
      const spentAmount = Number(
        spending.find((s) => s.category === b.category)?.spent ?? 0,
      );
      return {
        id: b.id,
        category: b.category,
        amount: b.amount,
        month: b.month,
        spentAmount,
        remaining: b.amount - spentAmount,
        percentUsed: b.amount > 0 ? Math.round((spentAmount / b.amount) * 100) : 0,
      };
    });
  }

  async create(data: Partial<BudgetEntity>, trx?: any): Promise<BudgetEntity> {
    const db = trx || this.db;
    const [result] = await db
      .insert(schema.budget)
      .values(data as typeof schema.budget.$inferInsert)
      .returning();
    return new BudgetEntity(result);
  }

  async update(
    id: string,
    workspaceId: string,
    data: Partial<BudgetEntity>,
  ): Promise<BudgetEntity> {
    const [result] = await this.db
      .update(schema.budget)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.budget.id, id), eq(schema.budget.workspaceId, workspaceId)))
      .returning();
    return new BudgetEntity(result);
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    await this.db
      .delete(schema.budget)
      .where(and(eq(schema.budget.id, id), eq(schema.budget.workspaceId, workspaceId)));
  }
}
