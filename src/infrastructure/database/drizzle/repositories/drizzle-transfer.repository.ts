import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, or, count, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { TransferEntity } from '../../../../core/entities/transfer.entity';
import { ITransferRepository, ListTransfersFilters } from '../../../../core/repositories/transfer.repository.interface';
import { PaginatedResult } from '../../../../core/dto/pagination.dto';
import { paginate } from '../helpers/paginate.helper';

@Injectable()
export class DrizzleTransferRepository implements ITransferRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string, workspaceId: string): Promise<TransferEntity | null> {
    const result = await this.db.query.transfer.findFirst({
      where: and(
        eq(schema.transfer.id, id),
        eq(schema.transfer.workspaceId, workspaceId),
      ),
    });
    return result ? new TransferEntity(result) : null;
  }

  async findAllByWorkspace(
    workspaceId: string,
    filters: ListTransfersFilters,
  ): Promise<PaginatedResult<TransferEntity>> {
    const { page, limit, startDate, endDate, accountId } = filters;
    const { limit: lim, offset } = paginate(page, limit);

    const conditions: SQL[] = [eq(schema.transfer.workspaceId, workspaceId)];

    if (startDate) conditions.push(gte(schema.transfer.date, startDate));
    if (endDate) conditions.push(lte(schema.transfer.date, endDate));
    if (accountId) {
      conditions.push(
        or(
          eq(schema.transfer.fromAccountId, accountId),
          eq(schema.transfer.toAccountId, accountId),
        ) as SQL,
      );
    }

    const where = and(...conditions);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.transfer)
      .where(where);

    const rows = await this.db
      .select()
      .from(schema.transfer)
      .where(where)
      .orderBy(schema.transfer.date, schema.transfer.createdAt)
      .limit(lim)
      .offset(offset);

    const totalNum = Number(total);

    return {
      data: rows.map((r) => new TransferEntity(r)),
      total: totalNum,
      page,
      limit,
      totalPages: Math.ceil(totalNum / limit),
    };
  }

  async create(data: Partial<TransferEntity>, trx?: any): Promise<TransferEntity> {
    const db = trx || this.db;
    const [result] = await db
      .insert(schema.transfer)
      .values(data as typeof schema.transfer.$inferInsert)
      .returning();
    return new TransferEntity(result);
  }

  async delete(id: string, workspaceId: string, trx?: any): Promise<void> {
    const db = trx || this.db;
    await db
      .delete(schema.transfer)
      .where(
        and(
          eq(schema.transfer.id, id),
          eq(schema.transfer.workspaceId, workspaceId),
        ),
      );
  }
}
