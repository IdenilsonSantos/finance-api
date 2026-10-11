export type TransactionType = 'income' | 'expense';

/**
 * Lançamentos de ajuste de saldo (saldo inicial, correção manual, conciliação
 * de extrato). Movimentam o saldo da conta, mas não são receita nem despesa:
 * ficam fora de relatórios, orçamentos e totais do período.
 */
export const ADJUSTMENT_CATEGORY = 'adjustment';

export class TransactionEntity {
  id: string;
  workspaceId: string;
  bankAccountId: string;
  amount: number;
  type: TransactionType;
  description: string | null;
  beneficiary: string | null;
  category: string;
  paymentMethod: string | null;
  date: string; // ISO date string: YYYY-MM-DD
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: TransactionEntity) {
    Object.assign(this, data);
  }
}
