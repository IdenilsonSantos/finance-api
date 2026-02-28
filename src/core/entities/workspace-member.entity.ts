export type WorkspaceRole = 'owner' | 'admin' | 'member';

export class WorkspaceMemberEntity {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<WorkspaceMemberEntity>) {
    Object.assign(this, partial);
  }
}
