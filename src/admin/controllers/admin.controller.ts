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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminAuthService } from '../services/admin-auth.service';
import { AdminService } from '../services/admin.service';
import { AdminLoginDto, AdminPaginationDto } from '../dto/admin.dto';
import { AdminJwtAuthGuard } from '../guards/admin-jwt.guard';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminService: AdminService,
  ) {}

  // ─── Auth (sem guard) ────────────────────────────────────────────────────

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login — sets admin_token cookie' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiCookieAuth('admin_token')
  @ApiOperation({ summary: 'Admin logout — clears admin_token cookie' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.adminAuthService.cookieName, this.adminAuthService.getClearCookieOptions());
  }

  // ─── Rotas protegidas ────────────────────────────────────────────────────

  @UseGuards(AdminJwtAuthGuard)
  @Get('stats')
  @ApiCookieAuth('admin_token')
  @ApiOperation({ summary: 'Get platform-wide aggregated stats' })
  @ApiResponse({ status: 200, description: 'Stats returned (COUNT/SUM only — no raw records)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats() {
    return this.adminService.getStats();
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('users')
  @ApiCookieAuth('admin_token')
  @ApiOperation({ summary: 'List users with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated users returned' })
  getUsers(@Query() query: AdminPaginationDto) {
    return this.adminService.getUsers(query);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('users/:id')
  @ApiCookieAuth('admin_token')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User returned' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('workspaces')
  @ApiCookieAuth('admin_token')
  @ApiOperation({ summary: 'List workspaces with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated workspaces returned' })
  getWorkspaces(@Query() query: AdminPaginationDto) {
    return this.adminService.getWorkspaces(query);
  }

  @UseGuards(AdminJwtAuthGuard)
  @Get('workspaces/:id')
  @ApiCookieAuth('admin_token')
  @ApiOperation({ summary: 'Get workspace details by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Workspace returned' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  getWorkspaceById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getWorkspaceById(id);
  }
}
