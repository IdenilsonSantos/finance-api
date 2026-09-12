export type BankAccountType = 'checking' | 'savings' | 'investment' | 'cash';

export class BankAccountEntity {
  id: string;
  workspaceId: string;
  name: string;
  type: BankAccountType;
  color: string;
  balance: number;
  /** Data até a qual `balance` está confirmado por um extrato importado (nulo se nunca importou). */
  balanceAsOf: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: BankAccountEntity) {
    Object.assign(this, data);
  }
}
