import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Resend } from 'resend';
import { format, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, lte, lt, desc, count } from 'drizzle-orm';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import {
  DEFAULT_PREFS,
  NotifPrefs,
  UpdateNotificationPrefsDto,
} from '../dto/notification-prefs.dto';
import { NotificationsGateway } from '../gateways/notifications.gateway';
import {
  transferCreatedTemplate,
  scheduledTransactionExecutedTemplate,
  goalCompletedTemplate,
  goalDeadlineReminderTemplate,
  budgetAlertTemplate,
} from '../email-templates';

function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function formatMonth(yearMonth: string): string {
  return format(parseISO(`${yearMonth}-01`), "MMMM 'de' yyyy", { locale: ptBR });
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Injectable()
export class NotificationsService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(
    config: ConfigService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly gateway: NotificationsGateway,
  ) {
    this.resend = new Resend(config.getOrThrow('RESEND_API_KEY'));
    this.from = config.getOrThrow('EMAIL_FROM');
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const items = await this.db
      .select()
      .from(schema.notification)
      .where(eq(schema.notification.userId, userId))
      .orderBy(desc(schema.notification.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(schema.notification)
      .where(eq(schema.notification.userId, userId));

    return { items, total: Number(total) };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const rows = await this.db
      .select({ id: schema.notification.id })
      .from(schema.notification)
      .where(
        and(
          eq(schema.notification.userId, userId),
          eq(schema.notification.read, false),
        ),
      );
    return rows.length;
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.db
      .update(schema.notification)
      .set({ read: true })
      .where(
        and(
          eq(schema.notification.id, notificationId),
          eq(schema.notification.userId, userId),
        ),
      );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.db
      .update(schema.notification)
      .set({ read: true })
      .where(eq(schema.notification.userId, userId));
  }

  async deleteRead(userId: string): Promise<void> {
    await this.db
      .delete(schema.notification)
      .where(
        and(
          eq(schema.notification.userId, userId),
          eq(schema.notification.read, true),
        ),
      );
  }

  async deleteOne(userId: string, notificationId: string): Promise<void> {
    await this.db
      .delete(schema.notification)
      .where(
        and(
          eq(schema.notification.id, notificationId),
          eq(schema.notification.userId, userId),
        ),
      );
  }

  async deleteAll(userId: string): Promise<void> {
    await this.db
      .delete(schema.notification)
      .where(eq(schema.notification.userId, userId));
  }

  async markAsUnread(userId: string, notificationId: string): Promise<void> {
    await this.db
      .update(schema.notification)
      .set({ read: false })
      .where(
        and(
          eq(schema.notification.id, notificationId),
          eq(schema.notification.userId, userId),
        ),
      );
  }

  private async createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
  ): Promise<void> {
    const [row] = await this.db
      .insert(schema.notification)
      .values({ userId, type, title, body })
      .returning();

    this.gateway.emitNewNotification(userId, row);
    const count = await this.getUnreadCount(userId);
    this.gateway.emitUnreadCount(userId, count);
  }

  async getPrefs(userId: string): Promise<NotifPrefs> {
    const row = await this.db
      .select()
      .from(schema.notificationPrefs)
      .where(eq(schema.notificationPrefs.userId, userId))
      .limit(1)
      .then((r) => r[0]);

    if (!row) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(row.prefs as object) };
  }

  async updatePrefs(userId: string, dto: UpdateNotificationPrefsDto): Promise<NotifPrefs> {
    const current = await this.getPrefs(userId);
    const merged = { ...current, ...dto };

    await this.db
      .insert(schema.notificationPrefs)
      .values({ userId, prefs: merged })
      .onConflictDoUpdate({
        target: schema.notificationPrefs.userId,
        set: { prefs: merged, updatedAt: new Date() },
      });

    return merged;
  }

  async notifyWorkspace(
    workspaceId: string,
    pref: keyof NotifPrefs,
    notification: { title: string; body: string },
    emailSend: (email: string) => Promise<void>,
  ): Promise<void> {
    const ws = await this.db
      .select({ ownerId: schema.workspace.ownerId })
      .from(schema.workspace)
      .where(eq(schema.workspace.id, workspaceId))
      .limit(1)
      .then((r) => r[0]);

    if (!ws) return;

    const owner = await this.db
      .select({ email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, ws.ownerId))
      .limit(1)
      .then((r) => r[0]);

    if (!owner) return;

    const prefs = await this.getPrefs(ws.ownerId);
    if (!prefs[pref]) return;

    await this.createNotification(
      ws.ownerId,
      pref,
      notification.title,
      notification.body,
    ).catch(() => {});

    await emailSend(owner.email).catch((err: unknown) => {
      console.error('[NotificationsService] Failed to send email:', err);
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleGoalDeadlineReminders(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const in7days = addDays(new Date(), 7).toISOString().slice(0, 10);

    const goals = await this.db
      .select({
        name: schema.goal.name,
        deadline: schema.goal.deadline,
        targetAmount: schema.goal.targetAmount,
        currentAmount: schema.goal.currentAmount,
        workspaceId: schema.goal.workspaceId,
      })
      .from(schema.goal)
      .where(
        and(
          gte(schema.goal.deadline, today),
          lte(schema.goal.deadline, in7days),
          lt(schema.goal.currentAmount, schema.goal.targetAmount),
        ),
      );

    for (const goal of goals) {
      const percentDone = Math.round((goal.currentAmount / goal.targetAmount) * 100);
      const remaining = formatBRL(goal.targetAmount - goal.currentAmount);
      const deadline = formatDate(goal.deadline!);

      await this.notifyWorkspace(
        goal.workspaceId,
        'goalDeadline',
        {
          title: `Meta "${goal.name}" vence em breve`,
          body: `Faltam ${remaining} para atingir sua meta. Prazo: ${deadline}.`,
        },
        (email) =>
          this.sendGoalDeadlineReminder({
            to: email,
            goalName: goal.name,
            deadline: goal.deadline!,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            percentDone,
          }),
      );
    }
  }

  async sendScheduledTransactionExecuted(params: {
    to: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    date: string;
  }) {
    const amount = formatBRL(params.amount);
    const date = formatDate(params.date);
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `Transação agendada executada: ${params.description}`,
      html: scheduledTransactionExecutedTemplate({
        description: params.description,
        amount,
        type: params.type,
        date,
      }),
    });
  }

  async sendTransferCreated(params: {
    to: string;
    fromAccount: string;
    toAccount: string;
    amount: number;
    date: string;
  }) {
    const amount = formatBRL(params.amount);
    const date = formatDate(params.date);
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `Transferência realizada: ${amount}`,
      html: transferCreatedTemplate({
        fromAccount: params.fromAccount,
        toAccount: params.toAccount,
        amount,
        date,
      }),
    });
  }

  async sendGoalCompleted(params: {
    to: string;
    goalName: string;
    targetAmount: number;
  }) {
    const amount = formatBRL(params.targetAmount);
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `Meta atingida: ${params.goalName}`,
      html: goalCompletedTemplate({
        goalName: params.goalName,
        targetAmount: amount,
      }),
    });
  }

  async sendBudgetAlert(params: {
    to: string;
    category: string;
    percent: number;
    spentAmount: number;
    budgetAmount: number;
    month: string;
  }) {
    const spent = formatBRL(params.spentAmount);
    const budget = formatBRL(params.budgetAmount);
    const month = formatMonth(params.month);
    const isExceeded = params.percent >= 100;
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: isExceeded
        ? `Orçamento esgotado: ${params.category} em ${month}`
        : `Alerta de orçamento: ${params.category} está em ${params.percent}%`,
      html: budgetAlertTemplate({
        category: params.category,
        percent: params.percent,
        spentAmount: spent,
        budgetAmount: budget,
        month,
      }),
    });
  }

  async sendGoalDeadlineReminder(params: {
    to: string;
    goalName: string;
    deadline: string;
    targetAmount: number;
    currentAmount: number;
    percentDone: number;
  }) {
    const target = formatBRL(params.targetAmount);
    const current = formatBRL(params.currentAmount);
    const deadline = formatDate(params.deadline);
    await this.resend.emails.send({
      from: this.from,
      to: params.to,
      subject: `Lembrete de meta: ${params.goalName} vence em ${deadline}`,
      html: goalDeadlineReminderTemplate({
        goalName: params.goalName,
        deadline,
        targetAmount: target,
        currentAmount: current,
        percentDone: params.percentDone,
      }),
    });
  }
}
