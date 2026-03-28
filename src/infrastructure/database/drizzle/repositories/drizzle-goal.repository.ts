import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, count, sql, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { GoalEntity } from '../../../../core/entities/goal.entity';
import { IGoalRepository, ListGoalsFilters } from '../../../../core/repositories/goal.repository.interface';
import { PaginatedResult } from '../../../../core/dto/pagination.dto';
import { paginate } from '../helpers/paginate.helper';

@Injectable()
export class DrizzleGoalRepository implements IGoalRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string, workspaceId: string): Promise<GoalEntity | null> {
    const result = await this.db.query.goal.findFirst({
      where: and(eq(schema.goal.id, id), eq(schema.goal.workspaceId, workspaceId)),
    });
    return result ? new GoalEntity(result) : null;
  }

  async findAllByWorkspace(
    workspaceId: string,
    filters: ListGoalsFilters,
  ): Promise<PaginatedResult<GoalEntity>> {
    const { page, limit, completed } = filters;
    const { limit: lim, offset } = paginate(page, limit);

    const conditions: SQL[] = [eq(schema.goal.workspaceId, workspaceId)];

    if (completed === true) {
      conditions.push(sql`${schema.goal.currentAmount} >= ${schema.goal.targetAmount}`);
    } else if (completed === false) {
      conditions.push(sql`${schema.goal.currentAmount} < ${schema.goal.targetAmount}`);
    }

    const where = and(...conditions);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.goal)
      .where(where);

    const rows = await this.db
      .select()
      .from(schema.goal)
      .where(where)
      .orderBy(schema.goal.createdAt)
      .limit(lim)
      .offset(offset);

    const totalNum = Number(total);

    return {
      data: rows.map((r) => new GoalEntity(r)),
      total: totalNum,
      page,
      limit,
      totalPages: Math.ceil(totalNum / limit),
    };
  }

  async findWithDeadlineBetween(from: string, to: string): Promise<GoalEntity[]> {
    const results = await this.db
      .select()
      .from(schema.goal)
      .where(and(gte(schema.goal.deadline, from), lte(schema.goal.deadline, to)));
    return results.map((r) => new GoalEntity(r));
  }

  async create(data: Partial<GoalEntity>): Promise<GoalEntity> {
    const [result] = await this.db
      .insert(schema.goal)
      .values(data as typeof schema.goal.$inferInsert)
      .returning();
    return new GoalEntity(result);
  }

  async update(
    id: string,
    workspaceId: string,
    data: Partial<GoalEntity>,
  ): Promise<GoalEntity> {
    const [result] = await this.db
      .update(schema.goal)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(schema.goal.id, id), eq(schema.goal.workspaceId, workspaceId)))
      .returning();
    return new GoalEntity(result);
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    await this.db
      .delete(schema.goal)
      .where(and(eq(schema.goal.id, id), eq(schema.goal.workspaceId, workspaceId)));
  }
}
