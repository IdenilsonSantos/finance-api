import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { DashboardService } from './services/dashboard.service';
import { DashboardController } from './controllers/dashboard.controller';

@Module({
  imports: [WorkspacesModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
