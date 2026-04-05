import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ActivityModule } from '../activity/activity.module';
import { BankAccountsService } from './services/bank-accounts.service';
import { BankAccountsController } from './controllers/bank-accounts.controller';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { IBankAccountRepository } from '../core/repositories/bank-account.repository.interface';
import { DrizzleBankAccountRepository } from '../infrastructure/database/drizzle/repositories/drizzle-bank-account.repository';
import { ITransactionRepository } from '../core/repositories/transaction.repository.interface';
import { DrizzleTransactionRepository } from '../infrastructure/database/drizzle/repositories/drizzle-transaction.repository';
import { OFXParserService } from './services/ofx-parser.service';
import { StatementImportService } from './services/statement-import.service';
import { CategoryInferenceService } from './services/category-inference.service';

@Module({
  imports: [WorkspacesModule, ActivityModule],
  providers: [
    BankAccountsService,
    OFXParserService,
    StatementImportService,
    CategoryInferenceService,
    WorkspaceGuard,
    { provide: IBankAccountRepository, useClass: DrizzleBankAccountRepository },
    { provide: ITransactionRepository, useClass: DrizzleTransactionRepository },
  ],
  controllers: [BankAccountsController],
  exports: [IBankAccountRepository],
})
export class BankAccountsModule {}
