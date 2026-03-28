import { WorkspaceInviteEntity, InviteRole } from '../entities/workspace-invite.entity';

export interface CreateInviteData {
  workspaceId: string;
  invitedEmail: string;
  role: InviteRole;
  token: string;
  expiresAt: Date;
  createdBy: string;
}

export interface IWorkspaceInviteRepository {
  create(data: CreateInviteData): Promise<WorkspaceInviteEntity>;
  findByToken(token: string): Promise<WorkspaceInviteEntity | null>;
  findByWorkspace(workspaceId: string): Promise<WorkspaceInviteEntity[]>;
  findPendingByEmail(workspaceId: string, email: string): Promise<WorkspaceInviteEntity | null>;
  markAccepted(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export const IWorkspaceInviteRepository = Symbol('IWorkspaceInviteRepository');
