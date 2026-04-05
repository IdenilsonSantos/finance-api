import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { IUserRepository } from '../../core/repositories/user.repository.interface';
import { IWorkspaceRepository } from '../../core/repositories/workspace.repository.interface';
import { IWorkspaceMemberRepository } from '../../core/repositories/workspace-member.repository.interface';
import { IAuthTokenRepository } from '../../core/repositories/auth-token.repository.interface';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { UserEntity } from '../../core/entities/user.entity';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: boolean;
  };
}

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    @Inject(IUserRepository) private readonly userRepository: IUserRepository,
    @Inject(IWorkspaceRepository)
    private readonly workspaceRepository: IWorkspaceRepository,
    @Inject(IWorkspaceMemberRepository)
    private readonly workspaceMemberRepository: IWorkspaceMemberRepository,
    @Inject(IAuthTokenRepository)
    private readonly authTokenRepository: IAuthTokenRepository,
    private readonly notificationsService: NotificationsService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name } = registerDto;

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Usuário com este e-mail já existe');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await this.db.transaction(async (trx) => {
      const user = await this.userRepository.create(
        { email, name, password: hashedPassword },
        trx,
      );

      const slug = `${(name ?? email.split('@')[0]).toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
      const workspace = await this.workspaceRepository.create(
        { name: 'Meu Workspace', slug, ownerId: user.id },
        trx,
      );

      await this.workspaceMemberRepository.create(
        { workspaceId: workspace.id, userId: user.id, role: 'owner' },
        trx,
      );

      return user;
    });

    this.sendVerificationEmail(newUser.id, newUser.email).catch(() => {});

    return this.generateAccessToken(newUser);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.generateAccessToken(user);
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

    await this.db.insert(schema.refreshToken).values({
      userId,
      tokenHash,
      expiresAt,
    });

    return token;
  }

  async refresh(token: string): Promise<AuthResponse> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [record] = await this.db
      .select()
      .from(schema.refreshToken)
      .where(
        and(
          eq(schema.refreshToken.tokenHash, tokenHash),
          eq(schema.refreshToken.revoked, false),
        ),
      )
      .limit(1);

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Token rotation: revoga o atual
    await this.db
      .update(schema.refreshToken)
      .set({ revoked: true })
      .where(eq(schema.refreshToken.id, record.id));

    const user = await this.userRepository.findById(record.userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return this.generateAccessToken(user);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    await this.db
      .update(schema.refreshToken)
      .set({ revoked: true })
      .where(eq(schema.refreshToken.tokenHash, tokenHash));
  }

  getCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    };
  }

  getClearCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
    };
  }

  get refreshTokenCookieName() {
    return REFRESH_TOKEN_COOKIE;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return; // silencioso — não revelar existência

    await this.authTokenRepository.deleteByUserAndType(user.id, 'password_reset');

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.authTokenRepository.create({ userId: user.id, tokenHash, type: 'password_reset', expiresAt });

    const resetUrl = `${FRONTEND_URL}/auth/reset-password?token=${token}`;
    this.notificationsService.sendPasswordReset({ to: email, resetUrl }).catch((err: unknown) => {
      console.error('[AuthService] Failed to send password reset email:', err);
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.authTokenRepository.findByHash(tokenHash, 'password_reset');

    if (!record) throw new NotFoundException('Token inválido');
    if (record.expiresAt < new Date()) throw new BadRequestException('Token expirado');
    if (record.usedAt) throw new BadRequestException('Token já foi utilizado');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.db.transaction(async (trx) => {
      await trx.update(schema.user).set({ password: hashedPassword }).where(eq(schema.user.id, record.userId));
      await trx.update(schema.refreshToken).set({ revoked: true }).where(eq(schema.refreshToken.userId, record.userId));
    });

    await this.authTokenRepository.markUsed(record.id);
  }

  async sendVerificationEmail(userId: string, email: string): Promise<void> {
    await this.authTokenRepository.deleteByUserAndType(userId, 'email_verification');

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.authTokenRepository.create({ userId, tokenHash, type: 'email_verification', expiresAt });

    const verifyUrl = `${FRONTEND_URL}/auth/verify-email?token=${token}`;
    await this.notificationsService.sendEmailVerification({ to: email, verifyUrl });
  }

  async verifyEmail(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.authTokenRepository.findByHash(tokenHash, 'email_verification');

    if (!record) throw new NotFoundException('Token inválido');
    if (record.expiresAt < new Date()) throw new BadRequestException('Token expirado');
    if (record.usedAt) throw new BadRequestException('Token já foi utilizado');

    await this.db.update(schema.user).set({ emailVerified: new Date() }).where(eq(schema.user.id, record.userId));
    await this.authTokenRepository.markUsed(record.id);
  }

  private generateAccessToken(user: UserEntity): AuthResponse {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name ?? null,
        email: user.email,
        emailVerified: !!user.emailVerified,
      },
    };
  }
}
