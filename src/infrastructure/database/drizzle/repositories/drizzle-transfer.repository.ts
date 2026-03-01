import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { TransferEntity } from '../../../../core/entities/transfer.entity';
import { ITransferRepository } from '../../../../core/repositories/transfer.repository.interface';

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

  async findAllByWorkspace(workspaceId: string): Promise<TransferEntity[]> {
    const results = await this.db.query.transfer.findMany({
      where: eq(schema.transfer.workspaceId, workspaceId),
      orderBy: (t, { desc }) => [desc(t.date), desc(t.createdAt)],
    });
    return results.map((r) => new TransferEntity(r));
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
