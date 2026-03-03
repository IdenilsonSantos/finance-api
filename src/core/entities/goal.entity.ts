export class GoalEntity {
  id: string;
  workspaceId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null; // YYYY-MM-DD
  color: string;
  createdAt: Date;
  updatedAt: Date;

  get isCompleted(): boolean {
    return this.currentAmount >= this.targetAmount;
  }

  constructor(data: Omit<GoalEntity, 'isCompleted'>) {
    Object.assign(this, data);
  }
}
