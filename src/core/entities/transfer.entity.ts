export class TransferEntity {
  id: string;
  workspaceId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description: string | null;
  date: string; // ISO date string: YYYY-MM-DD
  createdAt: Date;
  updatedAt: Date;

  constructor(data: TransferEntity) {
    Object.assign(this, data);
  }
}
