import { addDays, addMonths, addWeeks, addYears, format, getDaysInMonth } from 'date-fns';

/**
 * Fuso usado para decidir "que dia é hoje" (agendamentos, ajustes de saldo).
 * O servidor costuma rodar em UTC; sem isso, entre 21h e meia-noite no
 * Brasil o "hoje" do servidor já seria o dia seguinte.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Sao_Paulo';

/** Data de hoje (YYYY-MM-DD) no fuso do app. */
export function todayISO(timeZone: string = APP_TIMEZONE): string {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Interpreta YYYY-MM-DD como data local ao meio-dia. `new Date('2024-01-31')`
 * é UTC à meia-noite e, em fusos negativos, "volta" um dia ao usar getDate().
 */
export function parseISODate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export type RecurrenceFrequency = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/** Mesma data com o dia trocado por `day`, limitado ao último dia do mês. */
export function withClampedDay(date: Date, day: number): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setDate(Math.min(day, getDaysInMonth(result)));
  return result;
}

/**
 * Próxima ocorrência de uma recorrência. Mensal/anual usam o mesmo
 * comportamento dos bancos: 31/01 + 1 mês = 29/02 (último dia do mês),
 * nunca "transborda" para março. Com `anchorDay`, a data volta ao dia
 * original assim que o mês permitir (29/02 → 31/03), sem "escorregar".
 */
export function nextOccurrence(
  frequency: RecurrenceFrequency,
  current: string,
  anchorDay?: number | null,
): string | null {
  const date = parseISODate(current);
  switch (frequency) {
    case 'daily':
      return toISODate(addDays(date, 1));
    case 'weekly':
      return toISODate(addWeeks(date, 1));
    case 'monthly': {
      const next = addMonths(date, 1);
      return toISODate(anchorDay ? withClampedDay(next, anchorDay) : next);
    }
    case 'yearly': {
      const next = addYears(date, 1);
      return toISODate(anchorDay ? withClampedDay(next, anchorDay) : next);
    }
    default:
      return null;
  }
}

/** Dia âncora a guardar para a recorrência (só mensal/anual usam). */
export function anchorDayFor(frequency: RecurrenceFrequency, nextDate: string): number | null {
  return frequency === 'monthly' || frequency === 'yearly'
    ? parseISODate(nextDate).getDate()
    : null;
}

/** Último dia (YYYY-MM-DD) de um mês YYYY-MM. */
export function monthEndISO(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}
