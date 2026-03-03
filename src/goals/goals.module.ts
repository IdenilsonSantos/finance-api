import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GoalsService } from './services/goals.service';
import { GoalsController } from './controllers/goals.controller';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { IGoalRepository } from '../core/repositories/goal.repository.interface';
import { DrizzleGoalRepository } from '../infrastructure/database/drizzle/repositories/drizzle-goal.repository';

@Module({
  imports: [WorkspacesModule, NotificationsModule],
  providers: [
    GoalsService,
    WorkspaceGuard,
    { provide: IGoalRepository, useClass: DrizzleGoalRepository },
  ],
  controllers: [GoalsController],
  exports: [IGoalRepository],
})
export class GoalsModule {}
