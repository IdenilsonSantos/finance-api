import { ScheduledTransactionEntity } from '../entities/scheduled-transaction.entity';
import type { ScheduledTransactionFrequency } from '../entities/scheduled-transaction.entity';
import { PaginatedResult } from '../dto/pagination.dto';

export const IScheduledTransactionRepository = Symbol('IScheduledTransactionRepository');

export interface ListScheduledTransactionsFilters {
  page: number;
  limit: number;
  frequency?: ScheduledTransactionFrequency;
  accountId?: string;
}

export interface IScheduledTransactionRepository {
  findById(id: string, workspaceId: string): Promise<ScheduledTransactionEntity | null>;
  findAllByWorkspace(workspaceId: string, filters: ListScheduledTransactionsFilters): Promise<PaginatedResult<ScheduledTransactionEntity>>;
  findDue(upToDate: string): Promise<ScheduledTransactionEntity[]>;
  create(data: Partial<ScheduledTransactionEntity>, trx?: any): Promise<ScheduledTransactionEntity>;
  update(
    id: string,
    workspaceId: string,
    data: Partial<ScheduledTransactionEntity>,
    trx?: any,
  ): Promise<ScheduledTransactionEntity>;
  delete(id: string, workspaceId: string, trx?: any): Promise<void>;
}
