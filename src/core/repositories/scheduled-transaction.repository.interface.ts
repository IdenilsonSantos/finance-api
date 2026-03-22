import { ScheduledTransactionEntity } from '../entities/scheduled-transaction.entity';

export const IScheduledTransactionRepository = Symbol('IScheduledTransactionRepository');

export interface IScheduledTransactionRepository {
  findById(id: string, workspaceId: string): Promise<ScheduledTransactionEntity | null>;
  findAllByWorkspace(workspaceId: string): Promise<ScheduledTransactionEntity[]>;
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
