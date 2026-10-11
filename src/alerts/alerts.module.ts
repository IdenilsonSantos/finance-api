import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BudgetAlertsService } from './services/budget-alerts.service';

/** Alertas financeiros: orçamento, contas a vencer e faturas. */
@Module({
  imports: [NotificationsModule],
  providers: [BudgetAlertsService],
  exports: [BudgetAlertsService],
})
export class AlertsModule {}
