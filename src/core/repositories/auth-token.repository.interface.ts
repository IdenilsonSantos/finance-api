import { AuthTokenEntity } from '../entities/auth-token.entity';

export interface IAuthTokenRepository {
  create(data: { userId: string; tokenHash: string; type: string; expiresAt: Date }): Promise<void>;
  findByHash(tokenHash: string, type: string): Promise<AuthTokenEntity | null>;
  markUsed(id: string): Promise<void>;
  deleteByUserAndType(userId: string, type: string): Promise<void>;
}

export const IAuthTokenRepository = Symbol('IAuthTokenRepository');
