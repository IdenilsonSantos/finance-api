import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BankAccountsService } from './services/bank-accounts.service';
import { BankAccountsController } from './controllers/bank-accounts.controller';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { IBankAccountRepository } from '../core/repositories/bank-account.repository.interface';
import { DrizzleBankAccountRepository } from '../infrastructure/database/drizzle/repositories/drizzle-bank-account.repository';

@Module({
  imports: [WorkspacesModule],
  providers: [
    BankAccountsService,
    WorkspaceGuard,
    { provide: IBankAccountRepository, useClass: DrizzleBankAccountRepository },
  ],
  controllers: [BankAccountsController],
  exports: [IBankAccountRepository],
})
export class BankAccountsModule {}
