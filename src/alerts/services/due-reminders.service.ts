import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { addDays, format } from 'date-fns';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { APP_TIMEZONE, parseISODate, toISODate, todayISO } from '../../core/utils/date';
import { categoryLabel } from '../../core/utils/categories';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CategoriesService } from '../../categories/services/categories.service';
import { BankAccountsService } from '../../bank-accounts/services/bank-accounts.service';
import { CardCycle, invoicePeriod } from '../../core/utils/credit-card';

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
export function buildBillsReminder(
  bills: PendingBill[],
  today: string,
  labelOf: (category: string) => string = categoryLabel,
) {
  const dates = reminderDates(today);
  const when = (date: string) =>
    date === dates.overdue ? 'venceu ontem' : date === dates.today ? 'vence hoje' : `vence em ${REMINDER_DAYS_BEFORE} dias`;
  const order = [dates.overdue, dates.today, dates.soon];
  const sorted = [...bills].sort((a, b) => order.indexOf(a.date) - order.indexOf(b.date));

  const items = sorted.map((b) => ({
    description: b.description || labelOf(b.category),
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

/**
 * Faturas do cartão que pedem lembrete hoje: as que vencem hoje ou em
 * REMINDER_DAYS_BEFORE dias (a fatura é identificada pelo mês do vencimento).
 */
export function invoicesDueForReminder(cycle: CardCycle, today: string) {
  const { soon } = reminderDates(today);
  const months = [...new Set([today.slice(0, 7), soon.slice(0, 7)])];
  return months
    .map((month) => invoicePeriod(month, cycle))
    .filter((p) => p.dueDate === today || p.dueDate === soon)
    .map((p) => ({
      month: p.month,
      dueDate: p.dueDate,
      when: p.dueDate === today ? 'vence hoje' : `vence em ${REMINDER_DAYS_BEFORE} dias`,
    }));
}

@Injectable()
export class DueRemindersService {
  private readonly logger = new Logger(DueRemindersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly notificationsService: NotificationsService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: APP_TIMEZONE })
  async handleInvoiceReminders(): Promise<void> {
    const today = todayISO();
    const cards = await this.findActiveCards();
    let sent = 0;

    for (const card of cards) {
      const due = invoicesDueForReminder({ closingDay: card.closingDay!, dueDay: card.dueDay! }, today);
      for (const { month, dueDate, when } of due) {
        try {
          const invoice = await this.bankAccountsService.getInvoice(card.id, card.workspaceId, { month });
          if (invoice.status === 'paid' || invoice.remaining <= 0) continue;

          await this.notificationsService.notifyWorkspace(
            card.workspaceId,
            'invoiceReminder',
            {
              title: `Fatura do ${card.name} ${when}`,
              body: `Valor a pagar: ${formatBRL(invoice.remaining)}. Vencimento em ${format(parseISODate(dueDate), 'dd/MM')}.`,
            },
            (email) =>
              this.notificationsService.sendInvoiceDue({
                to: email,
                cardName: card.name,
                amount: invoice.remaining,
                dueDate,
                when,
              }),
          );
          sent++;
        } catch (err) {
          this.logger.error(
            `Falha no lembrete da fatura ${month} do cartão ${card.id}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    }

    this.logger.log(`Lembrete de faturas: ${sent} fatura(s) de ${cards.length} cartão(ões)`);
  }

  private async findActiveCards() {
    return this.db
      .select({
        id: schema.bankAccount.id,
        workspaceId: schema.bankAccount.workspaceId,
        name: schema.bankAccount.name,
        closingDay: schema.bankAccount.closingDay,
        dueDay: schema.bankAccount.dueDay,
      })
      .from(schema.bankAccount)
      .where(
        and(
          eq(schema.bankAccount.type, 'credit_card'),
          isNull(schema.bankAccount.archivedAt),
          isNotNull(schema.bankAccount.closingDay),
          isNotNull(schema.bankAccount.dueDay),
        ),
      );
  }

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
      const labelOf = await this.categoriesService.labelResolver(workspaceId);
      const reminder = buildBillsReminder(workspaceBills, today, labelOf);
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
