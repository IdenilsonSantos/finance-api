import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AdminController } from './controllers/admin.controller';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminService } from './services/admin.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('ADMIN_JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('ADMIN_JWT_EXPIRES_IN') ?? '8h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminService, AdminJwtStrategy],
})
export class AdminModule {}
