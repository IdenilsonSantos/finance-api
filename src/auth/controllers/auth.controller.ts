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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { GetUser } from '../decorators/get-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
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
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, returns access token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  @ApiCookieAuth('refresh_token')
  @ApiResponse({ status: 200, description: 'New access token returned' })
  @ApiResponse({ status: 401, description: 'Refresh token missing or invalid' })
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
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiCookieAuth('refresh_token')
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
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
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user info' })
  @ApiResponse({ status: 200, description: 'User info returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@GetUser() user: { userId: string; email: string }) {
    return user;
  }
}
