import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminService } from '../services/admin.service';
import { AdminLoginDto, AdminPaginationDto } from '../dto/admin.dto';
import { AdminJwtAuthGuard } from '../guards/admin-jwt.guard';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminService: AdminService,
  ) {}

  // ─── Auth (sem guard) ────────────────────────────────────────────────────

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminAuthService.login(dto);
    res.cookie(this.adminAuthService.cookieName, result.token, this.adminAuthService.getCookieOptions());
    return { email: result.email, name: result.name };
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.adminAuthService.cookieName, this.adminAuthService.getClearCookieOptions());
  }

  // ─── Rotas protegidas ────────────────────────────────────────────────────

  @UseGuards(AdminJwtAuthGuard)
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('users')
  getUsers(@Query() query: AdminPaginationDto) {
    return this.adminService.getUsers(query);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('users/:id')
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('workspaces')
  getWorkspaces(@Query() query: AdminPaginationDto) {
    return this.adminService.getWorkspaces(query);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('workspaces/:id')
  getWorkspaceById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getWorkspaceById(id);
  }
}
