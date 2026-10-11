import { addDays, addMonths, differenceInCalendarDays, format } from 'date-fns';
import { parseISODate, toISODate } from '../../core/utils/date';

/** Linha agregada: soma por mês, categoria e tipo (só efetivadas, sem ajustes). */
export interface ReportRow {
  month: string; // YYYY-MM
  category: string;
  type: 'income' | 'expense';
  total: number;
  count: number;
}

export interface ReportTotals {
  income: number;
  expense: number;
  balance: number;
  /** Fração do que entrou que sobrou (0.25 = 25%); null sem receitas. */
  savingsRate: number | null;
  incomeCount: number;
  expenseCount: number;
}

export interface ReportCategory {
  category: string;
  type: 'income' | 'expense';
  total: number;
  count: number;
  /** Participação no total do tipo (0..1). */
  share: number;
  previousTotal: number;
  /** Variação relativa ao período anterior; null quando lá era zero. */
  change: number | null;
  months: { month: string; total: number }[];
}

export interface Report {
  period: { startDate: string; endDate: string };
  previousPeriod: { startDate: string; endDate: string };
  totals: ReportTotals;
  previousTotals: ReportTotals;
  months: { month: string; income: number; expense: number; balance: number }[];
  categories: ReportCategory[];
}

/** Período anterior de mesma duração, terminando na véspera do início. */
export function previousPeriod(startDate: string, endDate: string) {
  const start = parseISODate(startDate);
  const days = differenceInCalendarDays(parseISODate(endDate), start) + 1;
  const prevEnd = addDays(start, -1);
  return { startDate: toISODate(addDays(prevEnd, -(days - 1))), endDate: toISODate(prevEnd) };
}

/** Meses (YYYY-MM) cobertos pelo período, em ordem. */
export function monthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  let cursor = parseISODate(`${startDate.slice(0, 7)}-01`);
  const last = endDate.slice(0, 7);
  while (format(cursor, 'yyyy-MM') <= last) {
    months.push(format(cursor, 'yyyy-MM'));
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function totalsOf(rows: ReportRow[]): ReportTotals {
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  for (const r of rows) {
    if (r.type === 'income') {
      income += r.total;
      incomeCount += r.count;
    } else {
      expense += r.total;
      expenseCount += r.count;
    }
  }
  return {
    income,
    expense,
    balance: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : null,
    incomeCount,
    expenseCount,
  };
}

export function buildReport(
  startDate: string,
  endDate: string,
  rows: ReportRow[],
  previousRows: ReportRow[],
): Report {
  const months = monthsBetween(startDate, endDate);
  const totals = totalsOf(rows);

  const monthly = months.map((month) => {
    const inMonth = rows.filter((r) => r.month === month);
    const income = inMonth.filter((r) => r.type === 'income').reduce((a, r) => a + r.total, 0);
    const expense = inMonth.filter((r) => r.type === 'expense').reduce((a, r) => a + r.total, 0);
    return { month, income, expense, balance: income - expense };
  });

  const key = (r: { category: string; type: string }) => `${r.type}|${r.category}`;
  const previousByKey = new Map<string, number>();
  for (const r of previousRows) previousByKey.set(key(r), (previousByKey.get(key(r)) ?? 0) + r.total);

  const grouped = new Map<string, ReportRow[]>();
  for (const r of rows) grouped.set(key(r), [...(grouped.get(key(r)) ?? []), r]);
  // Categorias que só existiam no período anterior também aparecem (total 0).
  for (const k of previousByKey.keys()) if (!grouped.has(k)) grouped.set(k, []);

  const categories: ReportCategory[] = [...grouped.entries()].map(([k, list]) => {
    const [type, category] = k.split('|') as ['income' | 'expense', string];
    const total = list.reduce((a, r) => a + r.total, 0);
    const previousTotal = previousByKey.get(k) ?? 0;
    const typeTotal = type === 'income' ? totals.income : totals.expense;
    return {
      category,
      type,
      total,
      count: list.reduce((a, r) => a + r.count, 0),
      share: typeTotal > 0 ? total / typeTotal : 0,
      previousTotal,
      change: previousTotal > 0 ? (total - previousTotal) / previousTotal : null,
      months: months.map((month) => ({
        month,
        total: list.filter((r) => r.month === month).reduce((a, r) => a + r.total, 0),
      })),
    };
  });
  // Despesas primeiro; dentro do tipo, maior total; empate decidido pelo nome
  // da categoria para a ordem ser sempre a mesma.
  categories.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'expense' ? -1 : 1;
    return b.total - a.total || a.category.localeCompare(b.category);
  });

  return {
    period: { startDate, endDate },
    previousPeriod: previousPeriod(startDate, endDate),
    totals,
    previousTotals: totalsOf(previousRows),
    months: monthly,
    categories,
  };
}
