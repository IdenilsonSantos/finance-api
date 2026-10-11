import { TransactionEntity } from '../entities/transaction.entity';
import type { TransactionStatus, TransactionType } from '../entities/transaction.entity';
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
  status?: TransactionStatus;
  /** Ordem por data; padrão `desc` (mais recentes primeiro). */
  order?: 'asc' | 'desc';
}

export interface TransactionsSummaryFilters {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  /** Data de hoje (YYYY-MM-DD), para contar pendências vencidas. */
  today: string;
}

export interface TransactionsSummary {
  /** Receitas efetivadas no período. */
  income: number;
  /** Despesas efetivadas no período. */
  expense: number;
  balance: number;
  incomeCount: number;
  expenseCount: number;
  /** Receitas pendentes (a receber) no período. */
  pendingIncome: number;
  /** Despesas pendentes (a pagar) no período. */
  pendingExpense: number;
  pendingCount: number;
  /** Pendências com data anterior a hoje, de qualquer período. */
  overdueCount: number;
  /** Datas (YYYY-MM-DD) com ao menos uma movimentação no período. */
  activeDates: string[];
}

export interface ITransactionRepository {
  findById(id: string, workspaceId: string): Promise<TransactionEntity | null>;
  findAllByWorkspace(workspaceId: string, filters: ListTransactionsFilters): Promise<PaginatedResult<TransactionEntity>>;
  /** Todas as parcelas de uma compra parcelada. */
  findByInstallmentGroup(groupId: string, workspaceId: string): Promise<TransactionEntity[]>;
  /** Totais de receitas/despesas do período, sem lançamentos de ajuste. */
  summarize(workspaceId: string, filters: TransactionsSummaryFilters): Promise<TransactionsSummary>;
  create(data: Partial<TransactionEntity>, trx?: any): Promise<TransactionEntity>;
  update(id: string, workspaceId: string, data: Partial<TransactionEntity>, trx?: any): Promise<TransactionEntity>;
  delete(id: string, workspaceId: string, trx?: any): Promise<void>;
  /** FITIDs já importados na conta (em transações ou transferências). */
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
  /**
   * Saldo de uma conta até `asOfDate` (inclusive) reconstruído pelo histórico:
   * transações efetivadas (entradas - saídas) + transferências recebidas - enviadas.
   * Usado para conciliar com o saldo informado pelo banco.
   */
  sumBalanceByBankAccountUpToDate(
    bankAccountId: string,
    asOfDate: string,
  ): Promise<number>;
  /** Data da transação mais antiga de uma conta, ou null; usado para detectar extratos retroativos. */
  findEarliestDateByBankAccount(bankAccountId: string): Promise<string | null>;
}
