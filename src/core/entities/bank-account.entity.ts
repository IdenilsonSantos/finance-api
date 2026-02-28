export type BankAccountType = 'checking' | 'savings' | 'investment' | 'cash';

export class BankAccountEntity {
  id: string;
  workspaceId: string;
  name: string;
  type: BankAccountType;
  color: string;
  balance: number;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: BankAccountEntity) {
    Object.assign(this, data);
  }
}
