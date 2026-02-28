import { WorkspaceEntity } from '../entities/workspace.entity';

export interface IWorkspaceRepository {
  findById(id: string): Promise<WorkspaceEntity | null>;
  findBySlug(slug: string): Promise<WorkspaceEntity | null>;
  create(workspace: Partial<WorkspaceEntity>, trx?: any): Promise<WorkspaceEntity>;
  update(id: string, workspace: Partial<WorkspaceEntity>): Promise<WorkspaceEntity>;
}

export const IWorkspaceRepository = Symbol('IWorkspaceRepository');
