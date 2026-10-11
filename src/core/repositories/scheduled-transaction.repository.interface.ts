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
  /**
   * Reivindica atomicamente a ocorrência `expectedNextDate`: avança para
   * `newNextDate` (ou remove o agendamento, se null). Retorna false se outra
   * execução (cron ou manual) já a processou — evita lançamento em dobro.
   */
  claimOccurrence(
    id: string,
    expectedNextDate: string,
    newNextDate: string | null,
    trx: any,
  ): Promise<boolean>;
  create(data: Partial<ScheduledTransactionEntity>, trx?: any): Promise<ScheduledTransactionEntity>;
  update(
    id: string,
    workspaceId: string,
    data: Partial<ScheduledTransactionEntity>,
    trx?: any,
  ): Promise<ScheduledTransactionEntity>;
  delete(id: string, workspaceId: string, trx?: any): Promise<void>;
}
