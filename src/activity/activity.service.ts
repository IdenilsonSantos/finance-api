import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { desc, eq, and, count } from 'drizzle-orm';
import { DRIZZLE } from '../db/database.module';
import * as schema from '../db/schema';

export type ActivityAction =
  | 'transaction.created'
  | 'transaction.updated'
  | 'transaction.deleted'
  | 'bankAccount.created'
  | 'bankAccount.updated'
  | 'bankAccount.deleted'
  | 'transfer.created'
  | 'transfer.deleted'
  | 'budget.created'
  | 'budget.updated'
  | 'budget.deleted'
  | 'goal.created'
  | 'goal.updated'
  | 'goal.deleted'
  | 'member.invited'
  | 'member.removed'
  | 'member.left'
  | 'member.roleUpdated';

export interface LogParams {
  workspaceId: string;
  userId: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface ListActivityParams {
  page?: number;
  limit?: number;
  entityType?: string;
  userId?: string;
  action?: string;
}

@Injectable()
export class ActivityService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  log(params: LogParams): void {
    this.db
      .insert(schema.workspaceActivity)
      .values({
        workspaceId: params.workspaceId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ?? {},
      })
      .catch((err: unknown) => {
        console.error('[ActivityService] Failed to log activity:', err);
      });
  }

  async getActivity(workspaceId: string, params: ListActivityParams) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(schema.workspaceActivity.workspaceId, workspaceId)];
    if (params.entityType) {
      conditions.push(eq(schema.workspaceActivity.entityType, params.entityType));
    }
    if (params.userId) {
      conditions.push(eq(schema.workspaceActivity.userId, params.userId));
    }
    if (params.action) {
      conditions.push(eq(schema.workspaceActivity.action, params.action));
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: schema.workspaceActivity.id,
          action: schema.workspaceActivity.action,
          entityType: schema.workspaceActivity.entityType,
          entityId: schema.workspaceActivity.entityId,
          metadata: schema.workspaceActivity.metadata,
          createdAt: schema.workspaceActivity.createdAt,
          user: {
            id: schema.user.id,
            name: schema.user.name,
            image: schema.user.image,
          },
        })
        .from(schema.workspaceActivity)
        .innerJoin(schema.user, eq(schema.workspaceActivity.userId, schema.user.id))
        .where(where)
        .orderBy(desc(schema.workspaceActivity.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(schema.workspaceActivity)
        .where(where),
    ]);

    return {
      data: rows,
      total: Number(total),
      page,
      limit,
      totalPages: Math.ceil(Number(total) / limit),
    };
  }
}
