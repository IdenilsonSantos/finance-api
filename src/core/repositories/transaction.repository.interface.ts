import { TransactionEntity } from '../entities/transaction.entity';
import type { TransactionType } from '../entities/transaction.entity';
import { PaginatedResult } from '../dto/pagination.dto';

export const ITransactionRepository = Symbol('ITransactionRepository');

export interface ListTransactionsFilters {
  page: number;
  limit: number;
  type?: TransactionType;
  category?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface ITransactionRepository {
  findById(id: string, workspaceId: string): Promise<TransactionEntity | null>;
  findAllByWorkspace(workspaceId: string, filters: ListTransactionsFilters): Promise<PaginatedResult<TransactionEntity>>;
  create(data: Partial<TransactionEntity>, trx?: any): Promise<TransactionEntity>;
  update(id: string, workspaceId: string, data: Partial<TransactionEntity>, trx?: any): Promise<TransactionEntity>;
  delete(id: string, workspaceId: string, trx?: any): Promise<void>;
  countByWorkspaceAndMonth(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<number>;
  findExternalIdsByBankAccount(
    bankAccountId: string,
    fitIds: string[],
  ): Promise<string[]>;
}
