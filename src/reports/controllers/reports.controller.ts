import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';
import { ReportsService } from '../services/reports.service';
import { ReportQueryDto } from '../dto/report.dto';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Income/expense report for a period, by month and category, vs the previous period' })
  @ApiResponse({ status: 200, description: 'Report returned' })
  getReport(@WorkspaceId() workspaceId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.getReport(workspaceId, query);
  }
}
