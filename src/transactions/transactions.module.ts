import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { ActivityModule } from '../activity/activity.module';
import { AlertsModule } from '../alerts/alerts.module';
import { TransactionsService } from './services/transactions.service';
import { TransactionsController } from './controllers/transactions.controller';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { ITransactionRepository } from '../core/repositories/transaction.repository.interface';
import { DrizzleTransactionRepository } from '../infrastructure/database/drizzle/repositories/drizzle-transaction.repository';
import { ITransferRepository } from '../core/repositories/transfer.repository.interface';
import { DrizzleTransferRepository } from '../infrastructure/database/drizzle/repositories/drizzle-transfer.repository';

@Module({
  imports: [WorkspacesModule, BankAccountsModule, ActivityModule, AlertsModule],
  providers: [
    TransactionsService,
    WorkspaceGuard,
    { provide: ITransactionRepository, useClass: DrizzleTransactionRepository },
    { provide: ITransferRepository, useClass: DrizzleTransferRepository },
  ],
  controllers: [TransactionsController],
  exports: [ITransactionRepository],
})
export class TransactionsModule {}
