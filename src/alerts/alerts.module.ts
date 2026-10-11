import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BankAccountsModule } from '../bank-accounts/bank-accounts.module';
import { CategoriesModule } from '../categories/categories.module';
import { BudgetAlertsService } from './services/budget-alerts.service';
import { DueRemindersService } from './services/due-reminders.service';

/** Alertas financeiros: orçamento, contas a vencer e faturas. */
@Module({
  imports: [NotificationsModule, BankAccountsModule, CategoriesModule],
  providers: [BudgetAlertsService, DueRemindersService],
  exports: [BudgetAlertsService],
})
export class AlertsModule {}
