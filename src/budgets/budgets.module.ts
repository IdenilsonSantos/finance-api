import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ActivityModule } from '../activity/activity.module';
import { BudgetsService } from './services/budgets.service';
import { BudgetsController } from './controllers/budgets.controller';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { IBudgetRepository } from '../core/repositories/budget.repository.interface';
import { DrizzleBudgetRepository } from '../infrastructure/database/drizzle/repositories/drizzle-budget.repository';

@Module({
  imports: [WorkspacesModule, ActivityModule],
  providers: [
    BudgetsService,
    WorkspaceGuard,
    { provide: IBudgetRepository, useClass: DrizzleBudgetRepository },
  ],
  controllers: [BudgetsController],
  exports: [IBudgetRepository],
})
export class BudgetsModule {}
