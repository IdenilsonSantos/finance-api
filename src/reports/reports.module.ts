import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './controllers/reports.controller';

@Module({
  imports: [WorkspacesModule],
  providers: [ReportsService, WorkspaceGuard],
  controllers: [ReportsController],
})
export class ReportsModule {}
