import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, ilike, or, count, sum, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { AdminPaginationDto } from '../dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getStats() {
    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    const [[totalUsers], [totalWorkspaces], [monthTransactions], [monthRevenue]] =
      await Promise.all([
        this.db.select({ count: count() }).from(schema.user),
        this.db.select({ count: count() }).from(schema.workspace),
        this.db
          .select({ count: count() })
          .from(schema.transaction)
          .where(
            and(
              gte(schema.transaction.date, monthStart),
              lte(schema.transaction.date, monthEnd),
            ),
          ),
        this.db
          .select({ total: sum(schema.transaction.amount) })
          .from(schema.transaction)
          .where(
            and(
              eq(schema.transaction.type, 'income'),
              gte(schema.transaction.date, monthStart),
              lte(schema.transaction.date, monthEnd),
            ),
          ),
      ]);

    return {
      totalUsers: totalUsers.count,
      totalWorkspaces: totalWorkspaces.count,
      monthTransactions: monthTransactions.count,
      monthRevenue: Number(monthRevenue.total ?? 0),
    };
  }

  async getUsers(query: AdminPaginationDto) {
    const { page = 1, limit = 20, search } = query;
    const offset = (page - 1) * limit;

    const where = search
      ? or(ilike(schema.user.name, `%${search}%`), ilike(schema.user.email, `%${search}%`))
      : undefined;

    const [users, [total]] = await Promise.all([
      this.db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          image: schema.user.image,
          createdAt: schema.user.createdAt,
          workspaceCount: sql<number>`(
            SELECT COUNT(*) FROM "workspaceMember"
            WHERE "workspaceMember"."userId" = "user"."id"
          )`.as('workspaceCount'),
        })
        .from(schema.user)
        .where(where)
        .orderBy(schema.user.createdAt)
        .limit(limit)
        .offset(offset),
      this.db.select({ count: count() }).from(schema.user).where(where),
    ]);

    return {
      data: users,
      meta: { total: total.count, page, limit, totalPages: Math.ceil(total.count / limit) },
    };
  }

  async getUserById(id: string) {
    const [userRow] = await this.db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        image: schema.user.image,
        createdAt: schema.user.createdAt,
      })
      .from(schema.user)
      .where(eq(schema.user.id, id))
      .limit(1);

    if (!userRow) throw new NotFoundException('Usuário não encontrado');

    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    const [[workspaceCount], userWorkspaces] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(schema.workspaceMember)
        .where(eq(schema.workspaceMember.userId, id)),
      this.db
        .select({ id: schema.workspace.id })
        .from(schema.workspace)
        .where(eq(schema.workspace.ownerId, id)),
    ]);

    const workspaceIds = userWorkspaces.map((w) => w.id);
    let monthStats = { transactionCount: 0, totalIncome: 0, totalExpense: 0 };

    if (workspaceIds.length > 0) {
      const [txStats] = await this.db
        .select({
          count: count(),
          totalIncome: sum(sql`CASE WHEN "type" = 'income' THEN "amount" ELSE 0 END`),
          totalExpense: sum(sql`CASE WHEN "type" = 'expense' THEN "amount" ELSE 0 END`),
        })
        .from(schema.transaction)
        .where(
          and(
            inArray(schema.transaction.workspaceId, workspaceIds),
            gte(schema.transaction.date, monthStart),
            lte(schema.transaction.date, monthEnd),
          ),
        );

      monthStats = {
        transactionCount: txStats.count,
        totalIncome: Number(txStats.totalIncome ?? 0),
        totalExpense: Number(txStats.totalExpense ?? 0),
      };
    }

    return { ...userRow, workspaceCount: workspaceCount.count, monthStats };
  }

  async getWorkspaces(query: AdminPaginationDto) {
    const { page = 1, limit = 20, search } = query;
    const offset = (page - 1) * limit;

    const where = search ? ilike(schema.workspace.name, `%${search}%`) : undefined;

    const [workspaces, [total]] = await Promise.all([
      this.db
        .select({
          id: schema.workspace.id,
          name: schema.workspace.name,
          slug: schema.workspace.slug,
          image: schema.workspace.image,
          createdAt: schema.workspace.createdAt,
          ownerName: schema.user.name,
          ownerEmail: schema.user.email,
          memberCount: sql<number>`(
            SELECT COUNT(*) FROM "workspaceMember"
            WHERE "workspaceMember"."workspaceId" = "workspace"."id"
          )`.as('memberCount'),
          transactionCount: sql<number>`(
            SELECT COUNT(*) FROM "transaction"
            WHERE "transaction"."workspaceId" = "workspace"."id"
          )`.as('transactionCount'),
        })
        .from(schema.workspace)
        .innerJoin(schema.user, eq(schema.workspace.ownerId, schema.user.id))
        .where(where)
        .orderBy(schema.workspace.createdAt)
        .limit(limit)
        .offset(offset),
      this.db.select({ count: count() }).from(schema.workspace).where(where),
    ]);

    return {
      data: workspaces,
      meta: { total: total.count, page, limit, totalPages: Math.ceil(total.count / limit) },
    };
  }

  async getWorkspaceById(id: string) {
    const [wsRow] = await this.db
      .select({
        id: schema.workspace.id,
        name: schema.workspace.name,
        slug: schema.workspace.slug,
        image: schema.workspace.image,
        createdAt: schema.workspace.createdAt,
        ownerName: schema.user.name,
        ownerEmail: schema.user.email,
      })
      .from(schema.workspace)
      .innerJoin(schema.user, eq(schema.workspace.ownerId, schema.user.id))
      .where(eq(schema.workspace.id, id))
      .limit(1);

    if (!wsRow) throw new NotFoundException('Workspace não encontrado');

    const now = new Date();
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

    const [[memberCount], [txStats]] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(schema.workspaceMember)
        .where(eq(schema.workspaceMember.workspaceId, id)),
      this.db
        .select({
          count: count(),
          totalIncome: sum(sql`CASE WHEN "type" = 'income' THEN "amount" ELSE 0 END`),
          totalExpense: sum(sql`CASE WHEN "type" = 'expense' THEN "amount" ELSE 0 END`),
        })
        .from(schema.transaction)
        .where(
          and(
            eq(schema.transaction.workspaceId, id),
            gte(schema.transaction.date, monthStart),
            lte(schema.transaction.date, monthEnd),
          ),
        ),
    ]);

    return {
      ...wsRow,
      memberCount: memberCount.count,
      monthStats: {
        transactionCount: txStats.count,
        totalIncome: Number(txStats.totalIncome ?? 0),
        totalExpense: Number(txStats.totalExpense ?? 0),
      },
    };
  }
}
