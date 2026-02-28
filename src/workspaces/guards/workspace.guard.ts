import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { IWorkspaceMemberRepository } from '../../core/repositories/workspace-member.repository.interface';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    @Inject(IWorkspaceMemberRepository)
    private readonly workspaceMemberRepository: IWorkspaceMemberRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { userId: string; email: string } | undefined;
    const workspaceId = request.headers['x-workspace-id'] as string | undefined;

    if (!workspaceId) {
      throw new BadRequestException('O cabeçalho x-workspace-id é obrigatório');
    }

    if (!user?.userId) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    const membership =
      await this.workspaceMemberRepository.findByWorkspaceAndUser(
        workspaceId,
        user.userId,
      );

    if (!membership) {
      throw new ForbiddenException('Você não tem acesso a este workspace');
    }

    (request as any).workspaceMember = membership;
    return true;
  }
}
