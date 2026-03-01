import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { TransactionsService } from './services/transactions.service';
import { TransactionsController } from './controllers/transactions.controller';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { ITransactionRepository } from '../core/repositories/transaction.repository.interface';
import { DrizzleTransactionRepository } from '../infrastructure/database/drizzle/repositories/drizzle-transaction.repository';

@Module({
  imports: [WorkspacesModule, BankAccountsModule],
  providers: [
    TransactionsService,
    WorkspaceGuard,
    { provide: ITransactionRepository, useClass: DrizzleTransactionRepository },
  ],
  controllers: [TransactionsController],
  exports: [ITransactionRepository],
})
export class TransactionsModule {}
