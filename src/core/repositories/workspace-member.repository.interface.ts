import {
  WorkspaceMemberEntity,
  WorkspaceRole,
} from '../entities/workspace-member.entity';

export interface IWorkspaceMemberRepository {
  findByWorkspaceAndUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberEntity | null>;
  findAllByWorkspace(workspaceId: string): Promise<WorkspaceMemberEntity[]>;
  create(
    member: Partial<WorkspaceMemberEntity>,
    trx?: any,
  ): Promise<WorkspaceMemberEntity>;
  updateRole(id: string, role: WorkspaceRole): Promise<WorkspaceMemberEntity>;
  remove(id: string): Promise<void>;
}

export const IWorkspaceMemberRepository = Symbol('IWorkspaceMemberRepository');
