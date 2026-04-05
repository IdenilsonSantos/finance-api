import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../../db/database.module';
import * as schema from '../../../../db/schema';
import { AuthTokenEntity } from '../../../../core/entities/auth-token.entity';
import { IAuthTokenRepository } from '../../../../core/repositories/auth-token.repository.interface';

@Injectable()
export class DrizzleAuthTokenRepository implements IAuthTokenRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(data: { userId: string; tokenHash: string; type: string; expiresAt: Date }): Promise<void> {
    await this.db.insert(schema.authToken).values({
      ...data,
      type: data.type as 'password_reset' | 'email_verification',
    });
  }

  async findByHash(tokenHash: string, type: string): Promise<AuthTokenEntity | null> {
    const result = await this.db.query.authToken.findFirst({
      where: and(
        eq(schema.authToken.tokenHash, tokenHash),
        eq(schema.authToken.type, type as 'password_reset' | 'email_verification'),
      ),
    });
    return result ? new AuthTokenEntity(result) : null;
  }

  async markUsed(id: string): Promise<void> {
    await this.db
      .update(schema.authToken)
      .set({ usedAt: new Date() })
      .where(eq(schema.authToken.id, id));
  }

  async deleteByUserAndType(userId: string, type: string): Promise<void> {
    await this.db
      .delete(schema.authToken)
      .where(
        and(
          eq(schema.authToken.userId, userId),
          eq(schema.authToken.type, type as 'password_reset' | 'email_verification'),
        ),
      );
  }
}
