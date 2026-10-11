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

/**
 * Pix/TED entre contas do próprio usuário quando a outra conta não está no
 * app (ex.: do Nubank para o Itaú). Também não é receita nem despesa.
 */
export const OWN_TRANSFER_CATEGORY = 'own_transfer';

/** Categorias que movimentam saldo mas ficam fora de receitas/despesas. */
export const NON_FLOW_CATEGORIES = [ADJUSTMENT_CATEGORY, OWN_TRANSFER_CATEGORY];

export function isNonFlowCategory(category: string): boolean {
  return NON_FLOW_CATEGORIES.includes(category);
}

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
