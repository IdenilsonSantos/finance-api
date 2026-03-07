import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';
import { DashboardService } from '../services/dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
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
