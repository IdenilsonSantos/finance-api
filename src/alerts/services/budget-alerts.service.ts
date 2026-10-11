import { Inject, Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, gte, inArray, lte, notInArray, sum } from 'drizzle-orm';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { NON_FLOW_CATEGORIES } from '../../core/entities/transaction.entity';
import { GLOBAL_BUDGET_CATEGORY } from '../../infrastructure/database/drizzle/repositories/drizzle-budget.repository';
import { CategoriesService, CategoryLabelResolver } from '../../categories/services/categories.service';
import { monthEndISO } from '../../core/utils/date';
import { NotificationsService } from '../../notifications/services/notifications.service';

/** Variação do gasto de uma categoria num mês (YYYY-MM) causada por uma operação. */
export interface BudgetChange {
  month: string;
  category: string;
  delta: number;
}

export type BudgetThreshold = 80 | 100;

/**
 * Faixa (80% ou 100%) cruzada quando o gasto passa de `before` para `after`.
 * Só dispara na passagem, então o mesmo alerta não se repete a cada gasto.
 */
export function crossedThreshold(before: number, after: number, limit: number): BudgetThreshold | null {
  if (limit <= 0) return null;
  for (const threshold of [100, 80] as const) {
    const mark = (limit * threshold) / 100;
    if (before < mark && after >= mark) return threshold;
  }
  return null;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Injectable()
export class BudgetAlertsService {
  private readonly logger = new Logger(BudgetAlertsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
    private readonly notificationsService: NotificationsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  /**
   * Verifica se as mudanças fizeram algum orçamento do mês cruzar 80% ou
   * 100% e notifica. O gasto considerado é o comprometido (pago + pendente),
   * o mesmo usado na tela de orçamentos.
   */
  async checkThresholds(workspaceId: string, changes: BudgetChange[]): Promise<void> {
    const byMonth = new Map<string, Map<string, number>>();
    for (const c of changes) {
      if (c.delta === 0) continue;
      const deltas = byMonth.get(c.month) ?? new Map<string, number>();
      deltas.set(c.category, (deltas.get(c.category) ?? 0) + c.delta);
      byMonth.set(c.month, deltas);
    }

    for (const [month, deltas] of byMonth) {
      const totalDelta = [...deltas.values()].reduce((a, b) => a + b, 0);
      if (totalDelta <= 0 && ![...deltas.values()].some((d) => d > 0)) continue;

      const budgets = await this.findBudgets(workspaceId, month, [...deltas.keys(), GLOBAL_BUDGET_CATEGORY]);
      if (budgets.length === 0) continue;

      const spending = await this.monthSpending(workspaceId, month);
      const labelOf = await this.categoriesService.labelResolver(workspaceId);
      const totalSpent = [...spending.values()].reduce((a, b) => a + b, 0);

      for (const budget of budgets) {
        const isGlobal = budget.category === GLOBAL_BUDGET_CATEGORY;
        const delta = isGlobal ? totalDelta : (deltas.get(budget.category) ?? 0);
        if (delta <= 0) continue;

        const after = isGlobal ? totalSpent : (spending.get(budget.category) ?? 0);
        const threshold = crossedThreshold(after - delta, after, budget.amount);
        if (!threshold) continue;

        await this.notify(workspaceId, budget, after, threshold, labelOf).catch((err: unknown) =>
          this.logger.error(`Falha ao notificar orçamento ${budget.id}`, err instanceof Error ? err.stack : String(err)),
        );
      }
    }
  }

  private async notify(
    workspaceId: string,
    budget: { category: string; amount: number; month: string },
    spent: number,
    threshold: BudgetThreshold,
    labelOf: CategoryLabelResolver,
  ) {
    const label = labelOf(budget.category);
    const monthLabel = format(parseISO(`${budget.month}-01`), "MMMM 'de' yyyy", { locale: ptBR });
    const percent = Math.floor((spent * 100) / budget.amount);
    const title =
      threshold === 100 ? `Orçamento de ${label} estourado` : `Orçamento de ${label} em ${percent}%`;
    const body =
      threshold === 100
        ? `Você já comprometeu ${formatBRL(spent)} de ${formatBRL(budget.amount)} em ${monthLabel}.`
        : `${formatBRL(spent)} de ${formatBRL(budget.amount)} em ${monthLabel}. Restam ${formatBRL(budget.amount - spent)}.`;

    await this.notificationsService.notifyWorkspace(workspaceId, 'budgetAlert', { title, body }, (email) =>
      this.notificationsService.sendBudgetAlert({
        to: email,
        category: label,
        percent,
        spentAmount: spent,
        budgetAmount: budget.amount,
        month: budget.month,
      }),
    );
  }

  private async findBudgets(workspaceId: string, month: string, categories: string[]) {
    return this.db
      .select({
        id: schema.budget.id,
        category: schema.budget.category,
        amount: schema.budget.amount,
        month: schema.budget.month,
      })
      .from(schema.budget)
      .where(
        and(
          eq(schema.budget.workspaceId, workspaceId),
          eq(schema.budget.month, month),
          inArray(schema.budget.category, categories),
        ),
      );
  }

  /** Gasto comprometido por categoria no mês (pago + pendente, sem ajustes). */
  private async monthSpending(workspaceId: string, month: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({ category: schema.transaction.category, spent: sum(schema.transaction.amount) })
      .from(schema.transaction)
      .where(
        and(
          eq(schema.transaction.workspaceId, workspaceId),
          eq(schema.transaction.type, 'expense'),
          notInArray(schema.transaction.category, NON_FLOW_CATEGORIES),
          gte(schema.transaction.date, `${month}-01`),
          lte(schema.transaction.date, monthEndISO(month)),
        ),
      )
      .groupBy(schema.transaction.category);
    return new Map(rows.map((r) => [r.category, Number(r.spent ?? 0)]));
  }
}
