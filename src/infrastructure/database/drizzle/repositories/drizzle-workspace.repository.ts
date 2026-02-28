import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { WorkspaceEntity } from '../../../../core/entities/workspace.entity';
import { IWorkspaceRepository } from '../../../../core/repositories/workspace.repository.interface';

@Injectable()
export class DrizzleWorkspaceRepository implements IWorkspaceRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string): Promise<WorkspaceEntity | null> {
    const result = await this.db.query.workspace.findFirst({
      where: eq(schema.workspace.id, id),
    });
    return result ? new WorkspaceEntity(result) : null;
  }

  async findBySlug(slug: string): Promise<WorkspaceEntity | null> {
    const result = await this.db.query.workspace.findFirst({
      where: eq(schema.workspace.slug, slug),
    });
    return result ? new WorkspaceEntity(result) : null;
  }

  async create(
    workspace: Partial<WorkspaceEntity>,
    trx?: any,
  ): Promise<WorkspaceEntity> {
    const db = trx || this.db;
    const [result] = await db
      .insert(schema.workspace)
      .values(workspace as typeof schema.workspace.$inferInsert)
      .returning();
    return new WorkspaceEntity(result);
  }

  async update(
    id: string,
    workspace: Partial<WorkspaceEntity>,
  ): Promise<WorkspaceEntity> {
    const [result] = await this.db
      .update(schema.workspace)
      .set({ ...workspace, updatedAt: new Date() })
      .where(eq(schema.workspace.id, id))
      .returning();
    return new WorkspaceEntity(result);
  }
}
