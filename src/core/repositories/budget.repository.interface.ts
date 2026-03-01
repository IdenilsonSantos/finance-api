import { BudgetEntity, BudgetSummaryItem } from '../entities/budget.entity';

export const IBudgetRepository = Symbol('IBudgetRepository');

export interface IBudgetRepository {
  findById(id: string, workspaceId: string): Promise<BudgetEntity | null>;
  findAllByWorkspace(workspaceId: string, month?: string): Promise<BudgetEntity[]>;
  getSummary(workspaceId: string, month: string): Promise<BudgetSummaryItem[]>;
  create(data: Partial<BudgetEntity>, trx?: any): Promise<BudgetEntity>;
  update(id: string, workspaceId: string, data: Partial<BudgetEntity>): Promise<BudgetEntity>;
  delete(id: string, workspaceId: string): Promise<void>;
}
