import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { APP_TIMEZONE, parseISODate, toISODate, todayISO } from '../../core/utils/date';
import { categoryLabel } from '../../core/utils/categories';
import { NotificationsService } from '../../notifications/services/notifications.service';

/** Antecedência do primeiro lembrete de vencimento. */
export const REMINDER_DAYS_BEFORE = 3;

export interface PendingBill {
  workspaceId: string;
  description: string | null;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Datas (YYYY-MM-DD) que geram lembrete hoje: em N dias, hoje e ontem (atrasada). */
export function reminderDates(today: string) {
  const base = parseISODate(today);
  return {
    soon: toISODate(addDays(base, REMINDER_DAYS_BEFORE)),
    today,
    overdue: toISODate(addDays(base, -1)),
  };
}

/**
 * Monta o lembrete de um workspace. Cada conta só aparece em três dias (N dias
 * antes, no dia e no dia seguinte ao vencimento), então ninguém recebe o mesmo
 * aviso todos os dias.
 */
export function buildBillsReminder(bills: PendingBill[], today: string) {
  const dates = reminderDates(today);
  const when = (date: string) =>
    date === dates.overdue ? 'venceu ontem' : date === dates.today ? 'vence hoje' : `vence em ${REMINDER_DAYS_BEFORE} dias`;
  const order = [dates.overdue, dates.today, dates.soon];
  const sorted = [...bills].sort((a, b) => order.indexOf(a.date) - order.indexOf(b.date));

  const items = sorted.map((b) => ({
    description: b.description || categoryLabel(b.category),
    amount: b.amount,
    when: when(b.date),
    kind: (b.type === 'expense' ? 'pay' : 'receive') as 'pay' | 'receive',
  }));
  const hasOverdue = sorted.some((b) => b.date === dates.overdue);

  const first = items[0];
  const title =
    items.length === 1
      ? `${first.kind === 'pay' ? 'Conta' : 'Recebimento'} "${first.description}" ${first.when}`
      : hasOverdue
        ? `${items.length} contas precisam de atenção, incluindo atrasadas`
        : `${items.length} contas vencendo`;
  const listed = items.slice(0, 3).map((i) => `${i.description} (${formatBRL(i.amount)}, ${i.when})`);
  const rest = items.length - listed.length;
  const body = listed.join('; ') + (rest > 0 ? ` e mais ${rest}.` : '.');

  return { title, body, items, hasOverdue };
}

@Injectable()
export class DueRemindersService {
  private readonly logger = new Logger(DueRemindersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: APP_TIMEZONE })
  async handleBillReminders(): Promise<void> {
    const today = todayISO();
    const { soon, overdue } = reminderDates(today);
    const bills = await this.findPendingBills([soon, today, overdue]);

    const byWorkspace = new Map<string, PendingBill[]>();
    for (const bill of bills) {
      byWorkspace.set(bill.workspaceId, [...(byWorkspace.get(bill.workspaceId) ?? []), bill]);
    }

    for (const [workspaceId, workspaceBills] of byWorkspace) {
      const reminder = buildBillsReminder(workspaceBills, today);
      await this.notificationsService
        .notifyWorkspace(workspaceId, 'billReminder', { title: reminder.title, body: reminder.body }, (email) =>
          this.notificationsService.sendBillsReminder({
            to: email,
            items: reminder.items,
            hasOverdue: reminder.hasOverdue,
          }),
        )
        .catch((err: unknown) =>
          this.logger.error(
            `Falha no lembrete de contas do workspace ${workspaceId}`,
            err instanceof Error ? err.stack : String(err),
          ),
        );
    }

    this.logger.log(`Lembrete de contas: ${bills.length} conta(s) em ${byWorkspace.size} workspace(s)`);
  }

  /** Contas pendentes nas datas informadas, ignorando contas bancárias arquivadas. */
  private async findPendingBills(dates: string[]): Promise<PendingBill[]> {
    return this.db
      .select({
        workspaceId: schema.transaction.workspaceId,
        description: schema.transaction.description,
        category: schema.transaction.category,
        amount: schema.transaction.amount,
        type: schema.transaction.type,
        date: schema.transaction.date,
      })
      .from(schema.transaction)
      .innerJoin(schema.bankAccount, eq(schema.transaction.bankAccountId, schema.bankAccount.id))
      .where(
        and(
          eq(schema.transaction.status, 'pending'),
          inArray(schema.transaction.date, dates),
          isNull(schema.bankAccount.archivedAt),
        ),
      );
  }
}
