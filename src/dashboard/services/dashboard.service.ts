import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, gte, asc, desc } from 'drizzle-orm';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getDashboard(
    workspaceId: string,
    options: { accountId?: string; category?: string } = {},
  ) {
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
    const sixMonthsAgo = format(subMonths(startOfMonth(now), 5), 'yyyy-MM-dd');
    const today = format(now, 'yyyy-MM-dd');

    const txBase = [
      eq(schema.transaction.workspaceId, workspaceId),
      gte(schema.transaction.date, sixMonthsAgo),
    ];
    if (options.accountId) {
      txBase.push(eq(schema.transaction.bankAccountId, options.accountId));
    }
    if (options.category) {
      txBase.push(eq(schema.transaction.category, options.category));
    }

    // Filtro para transações agendadas
    const schedBase = [
      eq(schema.scheduledTransaction.workspaceId, workspaceId),
      gte(schema.scheduledTransaction.nextDate, today),
    ];
    if (options.accountId) {
      schedBase.push(
        eq(schema.scheduledTransaction.bankAccountId, options.accountId),
      );
    }
    if (options.category) {
      schedBase.push(
        eq(schema.scheduledTransaction.category, options.category),
      );
    }

    const [accounts, transactions, budgets, goals, upcomingScheduled] =
      await Promise.all([
        // Contas bancárias
        this.db
          .select()
          .from(schema.bankAccount)
          .where(
            options.accountId
              ? and(
                  eq(schema.bankAccount.workspaceId, workspaceId),
                  eq(schema.bankAccount.id, options.accountId),
                )
              : eq(schema.bankAccount.workspaceId, workspaceId),
          ),

        // Transações dos últimos 6 meses (filtradas)
        this.db
          .select({
            id: schema.transaction.id,
            amount: schema.transaction.amount,
            type: schema.transaction.type,
            category: schema.transaction.category,
            description: schema.transaction.description,
            beneficiary: schema.transaction.beneficiary,
            paymentMethod: schema.transaction.paymentMethod,
            date: schema.transaction.date,
            bankAccountId: schema.transaction.bankAccountId,
            bankAccountName: schema.bankAccount.name,
            bankAccountColor: schema.bankAccount.color,
            createdAt: schema.transaction.createdAt,
          })
          .from(schema.transaction)
          .leftJoin(
            schema.bankAccount,
            eq(schema.transaction.bankAccountId, schema.bankAccount.id),
          )
          .where(and(...txBase))
          .orderBy(
            desc(schema.transaction.date),
            desc(schema.transaction.createdAt),
          ),

        // Orçamentos do mês atual
        this.db
          .select()
          .from(schema.budget)
          .where(
            and(
              eq(schema.budget.workspaceId, workspaceId),
              eq(schema.budget.month, currentMonth),
            ),
          ),

        // Metas
        this.db
          .select()
          .from(schema.goal)
          .where(eq(schema.goal.workspaceId, workspaceId)),

        // Próximas transações agendadas (até 5)
        this.db
          .select({
            id: schema.scheduledTransaction.id,
            amount: schema.scheduledTransaction.amount,
            type: schema.scheduledTransaction.type,
            category: schema.scheduledTransaction.category,
            description: schema.scheduledTransaction.description,
            frequency: schema.scheduledTransaction.frequency,
            nextDate: schema.scheduledTransaction.nextDate,
            bankAccountId: schema.scheduledTransaction.bankAccountId,
            bankAccountName: schema.bankAccount.name,
          })
          .from(schema.scheduledTransaction)
          .leftJoin(
            schema.bankAccount,
            eq(
              schema.scheduledTransaction.bankAccountId,
              schema.bankAccount.id,
            ),
          )
          .where(and(...schedBase))
          .orderBy(asc(schema.scheduledTransaction.nextDate))
          .limit(5),
      ]);

    // Cálculos mensais
    const currentMonthTxs = transactions.filter(
      (t) => t.date >= monthStart && t.date <= monthEnd,
    );

    const monthIncome = currentMonthTxs
      .filter((t) => t.type === 'income')
      .reduce((acc, t) => acc + t.amount, 0);

    const monthExpenses = currentMonthTxs
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);

    const monthSavings = monthIncome - monthExpenses;

    // Saldo total
    const totalBalance = accounts.reduce((acc, a) => acc + a.balance, 0);

    // Metas
    const reservedForGoals = goals.reduce(
      (acc, g) => acc + g.currentAmount,
      0,
    );
    const availableLiquidity = totalBalance - reservedForGoals;

    const monthlyGoalsTarget = goals.reduce((acc, g) => {
      if (!g.deadline) return acc;
      const diff = new Date(g.deadline).getTime() - now.getTime();
      const monthsLeft = Math.max(1, diff / (1000 * 60 * 60 * 24 * 30));
      return acc + Math.max(0, (g.targetAmount - g.currentAmount) / monthsLeft);
    }, 0);

    // Orçamento global
    const globalBudget = budgets.find((b) => b.category === 'all');
    const totalBudgetLimit = globalBudget?.amount ?? 0;
    const remainingBudget = Math.max(0, totalBudgetLimit - monthExpenses);

    // Projeção de saldo
    const upcomingIncome = upcomingScheduled
      .filter((s) => s.type === 'income')
      .reduce((acc, s) => acc + s.amount, 0);

    // Estimativa do que falta gastar no mês: média dos últimos meses
    // FECHADOS (até 3), em vez de extrapolar o ritmo de hoje (que distorce
    // muito quando contas grandes já foram pagas em lote no início do mês).
    const closedMonthExpenses = new Map<string, number>();
    for (const t of transactions) {
      const key = t.date.substring(0, 7);
      if (key === currentMonth || t.type !== 'expense') continue;
      closedMonthExpenses.set(key, (closedMonthExpenses.get(key) ?? 0) + t.amount);
    }
    const recentClosedMonths = Array.from(closedMonthExpenses.keys())
      .sort()
      .slice(-3)
      .map((key) => closedMonthExpenses.get(key)!);

    // Com menos de 2 meses fechados, um único mês (possivelmente atípico)
    // definiria 100% da previsão. Sem histórico suficiente, assume que o já
    // gasto é a estimativa do mês inteiro (estimatedRemainingExpenses = 0).
    const MIN_CLOSED_MONTHS_FOR_PROJECTION = 2;
    const historicalAvgMonthlyExpense =
      recentClosedMonths.length >= MIN_CLOSED_MONTHS_FOR_PROJECTION
        ? recentClosedMonths.reduce((a, b) => a + b, 0) / recentClosedMonths.length
        : monthExpenses;

    const estimatedRemainingExpenses = Math.max(
      0,
      historicalAvgMonthlyExpense - monthExpenses,
    );

    const projectedLiquidBalance =
      availableLiquidity + upcomingIncome - estimatedRemainingExpenses;
    const projectedBalance = projectedLiquidBalance - monthlyGoalsTarget;

    const savingsRate =
      monthIncome > 0 ? (monthSavings / monthIncome) * 100 : 0;

    // Fluxo de caixa (últimos 6 meses)
    const monthlyMap: Record<
      string,
      { income: number; expenses: number; month: string }
    > = {};

    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, 'yyyy-MM');
      const label = format(d, 'MMM', { locale: ptBR });
      monthlyMap[key] = {
        income: 0,
        expenses: 0,
        month: label.charAt(0).toUpperCase() + label.slice(1),
      };
    }

    transactions.forEach((t) => {
      const key = t.date.substring(0, 7);
      if (monthlyMap[key]) {
        if (t.type === 'income') monthlyMap[key].income += t.amount;
        else monthlyMap[key].expenses += t.amount;
      }
    });

    const cashFlow = Object.entries(monthlyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({
        month: v.month,
        income: v.income,
        expenses: v.expenses,
      }));

    const savingsOverview = cashFlow.map((m) => ({
      ...m,
      savings: m.income - m.expenses,
    }));

    const totalSavingsPeriod = savingsOverview.reduce(
      (acc, m) => acc + m.savings,
      0,
    );
    const averageSavings =
      savingsOverview.length > 0
        ? totalSavingsPeriod / savingsOverview.length
        : 0;

    // Despesas por categoria (mês atual)
    const categoryMap: Record<string, number> = {};
    let totalMonthExpensesForCategory = 0;

    currentMonthTxs
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        categoryMap[t.category] = (categoryMap[t.category] ?? 0) + t.amount;
        totalMonthExpensesForCategory += t.amount;
      });

    const expensesByCategory = Object.entries(categoryMap)
      .map(([category, value]) => ({
        category,
        value,
        percentage:
          totalMonthExpensesForCategory > 0
            ? Math.round((value / totalMonthExpensesForCategory) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: a.balance,
        color: a.color,
      })),

      financialInsights: {
        totalBalance,
        reservedForGoals,
        availableLiquidity,
        projectedBalance: Math.round(projectedBalance),
        remainingBudget,
        monthlyGoalsTarget: Math.round(monthlyGoalsTarget),
        isOverBudget: monthExpenses > totalBudgetLimit && totalBudgetLimit > 0,
        savingsRate: Math.round(savingsRate * 10) / 10,
        monthExpenses,
        monthIncome,
        monthSavings,
      },

      cashFlow,
      savingsOverview,
      expensesByCategory,
      averageSavings: Math.round(averageSavings),
      currentMonthSavings: monthSavings,

      budgets: budgets.map((b) => ({
        id: b.id,
        category: b.category,
        amount: b.amount,
        spent: categoryMap[b.category] ?? 0,
        remaining: Math.max(0, b.amount - (categoryMap[b.category] ?? 0)),
        percentage:
          b.amount > 0
            ? Math.round(
                ((categoryMap[b.category] ?? 0) / b.amount) * 100,
              )
            : 0,
      })),

      goals: goals.map((g) => ({
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        deadline: g.deadline,
        color: g.color,
        percentage:
          g.targetAmount > 0
            ? Math.round((g.currentAmount / g.targetAmount) * 100)
            : 0,
      })),

      recentTransactions: transactions.slice(0, 10),
      upcomingScheduled,
    };
  }
}
