export type TransactionType = 'income' | 'expense';

/** `pending` = conta a pagar/receber: ainda não movimentou o saldo da conta. */
export type TransactionStatus = 'paid' | 'pending';

export const TRANSACTION_STATUSES: TransactionStatus[] = ['paid', 'pending'];

/** Efeito da transação no saldo da conta (pendentes não movimentam). */
export function balanceEffect(t: { type: TransactionType; amount: number; status?: TransactionStatus }): number {
  if (t.status === 'pending') return 0;
  return t.type === 'income' ? t.amount : -t.amount;
}

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
  status: TransactionStatus;
  externalId: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: TransactionEntity) {
    Object.assign(this, data);
  }
}
