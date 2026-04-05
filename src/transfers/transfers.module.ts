import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { TransfersService } from './services/transfers.service';
import { TransfersController } from './controllers/transfers.controller';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { ITransferRepository } from '../core/repositories/transfer.repository.interface';
import { DrizzleTransferRepository } from '../infrastructure/database/drizzle/repositories/drizzle-transfer.repository';

@Module({
  imports: [WorkspacesModule, BankAccountsModule, NotificationsModule, ActivityModule],
  providers: [
    TransfersService,
    WorkspaceGuard,
    { provide: ITransferRepository, useClass: DrizzleTransferRepository },
  ],
  controllers: [TransfersController],
  exports: [ITransferRepository],
})
export class TransfersModule {}
