import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { BankAccountEntity } from '../../../../core/entities/bank-account.entity';
import { IBankAccountRepository } from '../../../../core/repositories/bank-account.repository.interface';

@Injectable()
export class DrizzleBankAccountRepository implements IBankAccountRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<BankAccountEntity | null> {
    const result = await this.db.query.bankAccount.findFirst({
      where: and(
        eq(schema.bankAccount.id, id),
        eq(schema.bankAccount.workspaceId, workspaceId),
      ),
    });
    return result ? new BankAccountEntity(result) : null;
  }

  async findAllByWorkspace(workspaceId: string): Promise<BankAccountEntity[]> {
    const results = await this.db.query.bankAccount.findMany({
      where: eq(schema.bankAccount.workspaceId, workspaceId),
    });
    return results.map((r) => new BankAccountEntity(r));
  }

  async create(
    data: Partial<BankAccountEntity>,
    trx?: any,
  ): Promise<BankAccountEntity> {
    const db = trx || this.db;
    const [result] = await db
      .insert(schema.bankAccount)
      .values(data as typeof schema.bankAccount.$inferInsert)
      .returning();
    return new BankAccountEntity(result);
  }

  async update(
    id: string,
    workspaceId: string,
    data: Partial<BankAccountEntity>,
  ): Promise<BankAccountEntity> {
    const [result] = await this.db
      .update(schema.bankAccount)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(schema.bankAccount.id, id),
          eq(schema.bankAccount.workspaceId, workspaceId),
        ),
      )
      .returning();
    return new BankAccountEntity(result);
  }

  async updateBalance(
    id: string,
    delta: number,
    trx: any,
  ): Promise<BankAccountEntity> {
    const [result] = await trx
      .update(schema.bankAccount)
      .set({
        balance: sql`${schema.bankAccount.balance} + ${delta}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.bankAccount.id, id))
      .returning();
    return new BankAccountEntity(result);
  }

  async advanceBalanceAsOf(id: string, asOfDate: string, trx: any): Promise<void> {
    const db = trx || this.db;
    await db
      .update(schema.bankAccount)
      .set({
        balanceAsOf: sql`greatest(coalesce(${schema.bankAccount.balanceAsOf}, ${asOfDate}), ${asOfDate})`,
        updatedAt: new Date(),
      })
      .where(eq(schema.bankAccount.id, id));
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    await this.db
      .delete(schema.bankAccount)
      .where(
        and(
          eq(schema.bankAccount.id, id),
          eq(schema.bankAccount.workspaceId, workspaceId),
        ),
      );
  }
}
