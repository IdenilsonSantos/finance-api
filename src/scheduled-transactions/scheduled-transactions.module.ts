import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ScheduledTransactionsService } from './services/scheduled-transactions.service';
import { ScheduledTransactionsController } from './controllers/scheduled-transactions.controller';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { IScheduledTransactionRepository } from '../core/repositories/scheduled-transaction.repository.interface';
import { DrizzleScheduledTransactionRepository } from '../infrastructure/database/drizzle/repositories/drizzle-scheduled-transaction.repository';

@Module({
  imports: [WorkspacesModule, BankAccountsModule, TransactionsModule],
  providers: [
    ScheduledTransactionsService,
    WorkspaceGuard,
    {
      provide: IScheduledTransactionRepository,
      useClass: DrizzleScheduledTransactionRepository,
    },
  ],
  controllers: [ScheduledTransactionsController],
  exports: [IScheduledTransactionRepository],
})
export class ScheduledTransactionsModule {}
