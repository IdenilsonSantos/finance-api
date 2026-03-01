import type { TransactionType } from './transaction.entity';

export type ScheduledTransactionFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export class ScheduledTransactionEntity {
  id: string;
  workspaceId: string;
  bankAccountId: string;
  amount: number;
  type: TransactionType;
  description: string | null;
  category: string;
  frequency: ScheduledTransactionFrequency;
  nextDate: string; // ISO date string: YYYY-MM-DD
  endDate: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: ScheduledTransactionEntity) {
    Object.assign(this, data);
  }
}
