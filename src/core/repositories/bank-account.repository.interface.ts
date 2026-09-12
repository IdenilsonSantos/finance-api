import { BankAccountEntity } from '../entities/bank-account.entity';

export const IBankAccountRepository = Symbol('IBankAccountRepository');

export interface IBankAccountRepository {
  findById(id: string, workspaceId: string): Promise<BankAccountEntity | null>;
  findAllByWorkspace(workspaceId: string): Promise<BankAccountEntity[]>;
  create(
    data: Partial<BankAccountEntity>,
    trx?: any,
  ): Promise<BankAccountEntity>;
  update(
    id: string,
    workspaceId: string,
    data: Partial<BankAccountEntity>,
  ): Promise<BankAccountEntity>;
  updateBalance(
    id: string,
    delta: number,
    trx: any,
  ): Promise<BankAccountEntity>;
  /** Avança `balanceAsOf` para `asOfDate`, sem nunca retroceder. */
  advanceBalanceAsOf(id: string, asOfDate: string, trx: any): Promise<void>;
  delete(id: string, workspaceId: string): Promise<void>;
}
