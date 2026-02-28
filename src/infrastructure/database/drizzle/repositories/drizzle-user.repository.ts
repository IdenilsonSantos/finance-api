import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { UserEntity } from '../../../../core/entities/user.entity';
import { IUserRepository } from '../../../../core/repositories/user.repository.interface';

@Injectable()
export class DrizzleUserRepository implements IUserRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    const result = await this.db.query.user.findFirst({
      where: eq(schema.user.id, id),
    });
    return result ? new UserEntity(result) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const result = await this.db.query.user.findFirst({
      where: eq(schema.user.email, email),
    });
    return result ? new UserEntity(result) : null;
  }

  async create(user: Partial<UserEntity>, trx?: any): Promise<UserEntity> {
    const db = trx || this.db;
    const [result] = await db
      .insert(schema.user)
      .values(user as typeof schema.user.$inferInsert)
      .returning();
    return new UserEntity(result);
  }

  async update(id: string, user: Partial<UserEntity>): Promise<UserEntity> {
    const [result] = await this.db
      .update(schema.user)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(schema.user.id, id))
      .returning();
    return new UserEntity(result);
  }
}
