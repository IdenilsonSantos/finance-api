export type BankAccountType = 'checking' | 'savings' | 'investment' | 'cash' | 'credit_card';

export const BANK_ACCOUNT_TYPES: BankAccountType[] = [
  'checking',
  'savings',
  'investment',
  'cash',
  'credit_card',
];

export class BankAccountEntity {
  id: string;
  workspaceId: string;
  name: string;
  type: BankAccountType;
  color: string;
  balance: number;
  /** Data até a qual `balance` está confirmado por um extrato importado (nulo se nunca importou). */
  balanceAsOf: string | null;
  /** Cartão de crédito: limite em centavos. */
  creditLimit: number | null;
  /** Cartão de crédito: dia do fechamento da fatura (1-31). */
  closingDay: number | null;
  /** Cartão de crédito: dia do vencimento da fatura (1-31). */
  dueDay: number | null;
  archivedAt: Date | null;
  /** Conta de origem, quando esta é a conta de investimento vinculada a ela. */
  linkedAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: BankAccountEntity) {
    Object.assign(this, data);
  }
}
