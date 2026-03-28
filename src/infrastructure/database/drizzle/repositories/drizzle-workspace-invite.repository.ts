import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { WorkspaceInviteEntity } from '../../../../core/entities/workspace-invite.entity';
import {
  CreateInviteData,
  IWorkspaceInviteRepository,
} from '../../../../core/repositories/workspace-invite.repository.interface';

@Injectable()
export class DrizzleWorkspaceInviteRepository implements IWorkspaceInviteRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: CreateInviteData): Promise<WorkspaceInviteEntity> {
    const [result] = await this.db
      .insert(schema.workspaceInvite)
      .values(data)
      .returning();
    return new WorkspaceInviteEntity(result);
  }

  async findByToken(token: string): Promise<WorkspaceInviteEntity | null> {
    const result = await this.db.query.workspaceInvite.findFirst({
      where: eq(schema.workspaceInvite.token, token),
    });
    return result ? new WorkspaceInviteEntity(result) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<WorkspaceInviteEntity[]> {
    const results = await this.db.query.workspaceInvite.findMany({
      where: eq(schema.workspaceInvite.workspaceId, workspaceId),
    });
    return results.map((r) => new WorkspaceInviteEntity(r));
  }

  async findPendingByEmail(workspaceId: string, email: string): Promise<WorkspaceInviteEntity | null> {
    const result = await this.db.query.workspaceInvite.findFirst({
      where: and(
        eq(schema.workspaceInvite.workspaceId, workspaceId),
        eq(schema.workspaceInvite.invitedEmail, email),
        isNull(schema.workspaceInvite.acceptedAt),
      ),
    });
    return result ? new WorkspaceInviteEntity(result) : null;
  }

  async markAccepted(id: string): Promise<void> {
    await this.db
      .update(schema.workspaceInvite)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.workspaceInvite.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(schema.workspaceInvite)
      .where(eq(schema.workspaceInvite.id, id));
  }
}
