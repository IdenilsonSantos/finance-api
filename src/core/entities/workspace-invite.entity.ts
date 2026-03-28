export type InviteRole = 'admin' | 'member';

export class WorkspaceInviteEntity {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  role: InviteRole;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdBy: string;
  createdAt: Date;

  constructor(partial: Partial<WorkspaceInviteEntity>) {
    Object.assign(this, partial);
  }
}
