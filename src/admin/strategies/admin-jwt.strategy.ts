import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface AdminJwtPayload {
  sub: string;
  email: string;
  role: 'admin';
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.['admin_token'] as string) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('ADMIN_JWT_SECRET'),
    });
  }

  validate(payload: AdminJwtPayload) {
    if (payload.role !== 'admin') {
      throw new UnauthorizedException('Acesso negado');
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
