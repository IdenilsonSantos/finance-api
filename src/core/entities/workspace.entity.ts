export class WorkspaceEntity {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<WorkspaceEntity>) {
    Object.assign(this, partial);
  }
}
