import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TransfersModule } from './transfers/transfers.module';
import { ScheduledTransactionsModule } from './scheduled-transactions/scheduled-transactions.module';
import { BudgetsModule } from './budgets/budgets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GoalsModule } from './goals/goals.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    BankAccountsModule,
    TransactionsModule,
    TransfersModule,
    ScheduledTransactionsModule,
    BudgetsModule,
    NotificationsModule,
    GoalsModule,
    DashboardModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
