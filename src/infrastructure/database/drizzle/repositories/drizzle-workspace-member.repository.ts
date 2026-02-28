import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { WorkspaceMemberEntity, WorkspaceRole } from '../../../../core/entities/workspace-member.entity';
import { IWorkspaceMemberRepository } from '../../../../core/repositories/workspace-member.repository.interface';

@Injectable()
export class DrizzleWorkspaceMemberRepository implements IWorkspaceMemberRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberEntity | null> {
    const result = await this.db.query.workspaceMember.findFirst({
      where: and(
        eq(schema.workspaceMember.workspaceId, workspaceId),
        eq(schema.workspaceMember.userId, userId),
      ),
    });
    return result ? new WorkspaceMemberEntity(result) : null;
  }

  async create(
    member: Partial<WorkspaceMemberEntity>,
    trx?: any,
  ): Promise<WorkspaceMemberEntity> {
    const db = trx || this.db;
    const [result] = await db
      .insert(schema.workspaceMember)
      .values(member as typeof schema.workspaceMember.$inferInsert)
      .returning();
    return new WorkspaceMemberEntity(result);
  }

  async updateRole(id: string, role: WorkspaceRole): Promise<WorkspaceMemberEntity> {
    const [result] = await this.db
      .update(schema.workspaceMember)
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.workspaceMember.id, id))
      .returning();
    return new WorkspaceMemberEntity(result);
  }

  async remove(id: string): Promise<void> {
    await this.db
      .delete(schema.workspaceMember)
      .where(eq(schema.workspaceMember.id, id));
  }
}
