import { GoalEntity } from '../entities/goal.entity';
import { PaginatedResult } from '../dto/pagination.dto';

export interface IGoalRepository {
  findById(id: string, workspaceId: string): Promise<GoalEntity | null>;
  findAllByWorkspace(workspaceId: string, filters: ListGoalsFilters): Promise<PaginatedResult<GoalEntity>>;
  findWithDeadlineBetween(from: string, to: string): Promise<GoalEntity[]>;
  create(data: Partial<GoalEntity>): Promise<GoalEntity>;
  update(id: string, workspaceId: string, data: Partial<GoalEntity>): Promise<GoalEntity>;
  delete(id: string, workspaceId: string): Promise<void>;
}

export interface ListGoalsFilters {
  page: number;
  limit: number;
  completed?: boolean;
}

export const IGoalRepository = Symbol('IGoalRepository');
