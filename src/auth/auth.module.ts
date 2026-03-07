import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { IUserRepository } from '../core/repositories/user.repository.interface';
import { DrizzleUserRepository } from '../infrastructure/database/drizzle/repositories/drizzle-user.repository';
import { IWorkspaceRepository } from '../core/repositories/workspace.repository.interface';
import { DrizzleWorkspaceRepository } from '../infrastructure/database/drizzle/repositories/drizzle-workspace.repository';
import { IWorkspaceMemberRepository } from '../core/repositories/workspace-member.repository.interface';
import { DrizzleWorkspaceMemberRepository } from '../infrastructure/database/drizzle/repositories/drizzle-workspace-member.repository';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<StringValue>('JWT_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: IUserRepository, useClass: DrizzleUserRepository },
    { provide: IWorkspaceRepository, useClass: DrizzleWorkspaceRepository },
    {
      provide: IWorkspaceMemberRepository,
      useClass: DrizzleWorkspaceMemberRepository,
    },
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    IUserRepository,
    IWorkspaceRepository,
    IWorkspaceMemberRepository,
  ],
})
export class AuthModule {}
