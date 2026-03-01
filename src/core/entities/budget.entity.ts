export class BudgetEntity {
  id: string;
  workspaceId: string;
  category: string;
  amount: number;
  month: string; // YYYY-MM
  createdAt: Date;
  updatedAt: Date;

  constructor(data: BudgetEntity) {
    Object.assign(this, data);
  }
}

export interface BudgetSummaryItem {
  id: string;
  category: string;
  amount: number;
  month: string; // YYYY-MM
  spentAmount: number;
  remaining: number;
  percentUsed: number;
}
