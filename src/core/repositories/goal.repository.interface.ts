import { GoalEntity } from '../entities/goal.entity';

export interface IGoalRepository {
  findById(id: string, workspaceId: string): Promise<GoalEntity | null>;
  findAllByWorkspace(workspaceId: string): Promise<GoalEntity[]>;
  findWithDeadlineBetween(from: string, to: string): Promise<GoalEntity[]>;
  create(data: Partial<GoalEntity>): Promise<GoalEntity>;
  update(id: string, workspaceId: string, data: Partial<GoalEntity>): Promise<GoalEntity>;
  delete(id: string, workspaceId: string): Promise<void>;
}

export const IGoalRepository = Symbol('IGoalRepository');
