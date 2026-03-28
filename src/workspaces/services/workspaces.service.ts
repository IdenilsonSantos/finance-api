import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IWorkspaceRepository } from '../../core/repositories/workspace.repository.interface';
import { IWorkspaceMemberRepository } from '../../core/repositories/workspace-member.repository.interface';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../dto/workspace.dto';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(IWorkspaceRepository)
    private readonly workspaceRepository: IWorkspaceRepository,
    @Inject(IWorkspaceMemberRepository)
    private readonly workspaceMemberRepository: IWorkspaceMemberRepository,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async create(dto: CreateWorkspaceDto, userId: string) {
    const slug =
      dto.slug ||
      `${dto.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    return this.db.transaction(async (trx) => {
      const workspace = await this.workspaceRepository.create(
        { name: dto.name, slug, ownerId: userId },
        trx,
      );
      await this.workspaceMemberRepository.create(
        { workspaceId: workspace.id, userId, role: 'owner' },
        trx,
      );
      return workspace;
    });
  }

  async findById(id: string) {
    const workspace = await this.workspaceRepository.findById(id);
    if (!workspace) throw new NotFoundException('Workspace não encontrado');
    return workspace;
  }

  async findByUserId(userId: string) {
    const results = await this.workspaceRepository.findByUserId(userId);
    return results.map(({ workspace, role }) => ({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role,
    }));
  }

  async update(id: string, dto: UpdateWorkspaceDto) {
    return this.workspaceRepository.update(id, dto);
  }

  async delete(id: string): Promise<void> {
    await this.workspaceRepository.delete(id);
  }
}
