import { TransactionEntity } from '../entities/transaction.entity';

export const ITransactionRepository = Symbol('ITransactionRepository');

export interface ITransactionRepository {
  findById(id: string, workspaceId: string): Promise<TransactionEntity | null>;
  findAllByWorkspace(workspaceId: string): Promise<TransactionEntity[]>;
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
