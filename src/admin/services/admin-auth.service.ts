import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import type { CookieOptions } from 'express';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { AdminLoginDto } from '../dto/admin.dto';

const ADMIN_COOKIE_NAME = 'admin_token';

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: AdminLoginDto): Promise<{ token: string; email: string; name: string }> {
    const [admin] = await this.db
      .select()
      .from(schema.adminUser)
      .where(eq(schema.adminUser.email, dto.email))
      .limit(1);

    if (!admin) throw new UnauthorizedException('Credenciais inválidas');

    const valid = await bcrypt.compare(dto.password, admin.password);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    const token = this.jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: 'admin',
    });

    return { token, email: admin.email, name: admin.name };
  }

  get cookieName(): string {
    return ADMIN_COOKIE_NAME;
  }

  getCookieOptions(): CookieOptions {
    const isProd = this.configService.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    };
  }

  getClearCookieOptions(): CookieOptions {
    const isProd = this.configService.get('NODE_ENV') === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    };
  }
}
