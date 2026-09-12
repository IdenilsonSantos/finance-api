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
  /** Transações de uma conta num período (inclusive); usado para detectar duplicidades sem FITID. */
  findByBankAccountInDateRange(
    bankAccountId: string,
    startDate: string,
    endDate: string,
  ): Promise<TransactionEntity[]>;
  /** Soma líquida (entradas - saídas) de uma conta até `asOfDate`; usado para conciliar com o banco. */
  sumBalanceByBankAccountUpToDate(
    bankAccountId: string,
    asOfDate: string,
  ): Promise<number>;
  /** Data da transação mais antiga de uma conta, ou null; usado para detectar extratos retroativos. */
  findEarliestDateByBankAccount(bankAccountId: string): Promise<string | null>;
}
