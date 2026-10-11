import { addDays, addMonths, format } from 'date-fns';
import { parseISODate, toISODate, withClampedDay } from './date';

/**
 * Regras de fatura de cartão de crédito.
 *
 * Uma fatura é identificada pelo mês do vencimento (YYYY-MM). Ela fecha no
 * `closingDay` do mesmo mês do vencimento quando o vencimento vem depois do
 * fechamento (fecha 03, vence 10), ou do mês anterior caso contrário (fecha
 * 25, vence 05). Compras feitas NO dia do fechamento já entram na fatura
 * seguinte — é o "melhor dia de compra" dos bancos.
 */
export interface CardCycle {
  closingDay: number;
  dueDay: number;
}

export interface InvoicePeriod {
  /** Mês da fatura (mês do vencimento), YYYY-MM. */
  month: string;
  /** Primeiro dia de compras desta fatura (inclusive). */
  start: string;
  /** Último dia de compras desta fatura (inclusive). */
  end: string;
  closingDate: string;
  dueDate: string;
}

function monthDate(month: string): Date {
  return parseISODate(`${month}-01`);
}

function closingOffset({ closingDay, dueDay }: CardCycle): number {
  return dueDay > closingDay ? 0 : -1;
}

function closingDateFor(month: string, cycle: CardCycle): Date {
  return withClampedDay(addMonths(monthDate(month), closingOffset(cycle)), cycle.closingDay);
}

export function shiftMonth(month: string, delta: number): string {
  return format(addMonths(monthDate(month), delta), 'yyyy-MM');
}

export function invoicePeriod(month: string, cycle: CardCycle): InvoicePeriod {
  const closing = closingDateFor(month, cycle);
  const previousClosing = closingDateFor(shiftMonth(month, -1), cycle);
  return {
    month,
    start: toISODate(previousClosing),
    end: toISODate(addDays(closing, -1)),
    closingDate: toISODate(closing),
    dueDate: toISODate(withClampedDay(monthDate(month), cycle.dueDay)),
  };
}

/** Mês da fatura em que entra uma compra feita em `date` (YYYY-MM-DD). */
export function invoiceMonthForDate(date: string, cycle: CardCycle): string {
  const d = parseISODate(date);
  const closingThisMonth = withClampedDay(d, cycle.closingDay);
  const closingMonth = d >= closingThisMonth ? addMonths(d, 1) : d;
  return format(addMonths(closingMonth, -closingOffset(cycle)), 'yyyy-MM');
}
