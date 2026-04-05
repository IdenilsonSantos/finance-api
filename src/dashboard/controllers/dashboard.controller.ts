import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';
import { DashboardService } from '../services/dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Get aggregated dashboard stats for the workspace' })
  @ApiQuery({ name: 'accountId', required: false, type: String, format: 'uuid', description: 'Filter by bank account' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category' })
  @ApiResponse({ status: 200, description: 'Dashboard stats returned' })
  getDashboard(
    @WorkspaceId() workspaceId: string,
    @Query('accountId') accountId?: string,
    @Query('category') category?: string,
  ) {
    return this.dashboardService.getDashboard(workspaceId, {
      accountId,
      category,
    });
  }
}
