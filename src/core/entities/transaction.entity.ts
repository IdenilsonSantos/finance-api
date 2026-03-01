export type TransactionType = 'income' | 'expense';

export class TransactionEntity {
  id: string;
  workspaceId: string;
  bankAccountId: string;
  amount: number;
  type: TransactionType;
  description: string | null;
  category: string;
  date: string; // ISO date string: YYYY-MM-DD
  createdAt: Date;
  updatedAt: Date;

  constructor(data: TransactionEntity) {
    Object.assign(this, data);
  }
}
