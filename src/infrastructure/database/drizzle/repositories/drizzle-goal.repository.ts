import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { GoalEntity } from '../../../../core/entities/goal.entity';
import { IGoalRepository } from '../../../../core/repositories/goal.repository.interface';

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

  async findAllByWorkspace(workspaceId: string): Promise<GoalEntity[]> {
    const results = await this.db.query.goal.findMany({
      where: eq(schema.goal.workspaceId, workspaceId),
      orderBy: (goal, { desc }) => [desc(goal.createdAt)],
    });
    return results.map((r) => new GoalEntity(r));
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
