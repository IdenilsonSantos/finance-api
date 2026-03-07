import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetUser } from '../decorators/get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(registerDto);
    const refreshToken = await this.authService.createRefreshToken(
      result.user.id,
    );
    res.cookie(
      this.authService.refreshTokenCookieName,
      refreshToken,
      this.authService.getCookieOptions(),
    );
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    const refreshToken = await this.authService.createRefreshToken(
      result.user.id,
    );
    res.cookie(
      this.authService.refreshTokenCookieName,
      refreshToken,
      this.authService.getCookieOptions(),
    );
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token: string | undefined =
      req.cookies[this.authService.refreshTokenCookieName];
    if (!token) {
      throw new UnauthorizedException('Refresh token não encontrado');
    }

    const result = await this.authService.refresh(token);
    const newRefreshToken = await this.authService.createRefreshToken(
      result.user.id,
    );
    res.cookie(
      this.authService.refreshTokenCookieName,
      newRefreshToken,
      this.authService.getCookieOptions(),
    );
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token: string | undefined =
      req.cookies[this.authService.refreshTokenCookieName];
    if (token) {
      await this.authService.revokeRefreshToken(token);
    }
    res.clearCookie(
      this.authService.refreshTokenCookieName,
      this.authService.getClearCookieOptions(),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@GetUser() user: { userId: string; email: string }) {
    return user;
  }
}
