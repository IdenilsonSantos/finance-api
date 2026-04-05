export type AuthTokenType = 'password_reset' | 'email_verification';

export class AuthTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  type: AuthTokenType;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;

  constructor(partial: Partial<AuthTokenEntity>) {
    Object.assign(this, partial);
  }
}
