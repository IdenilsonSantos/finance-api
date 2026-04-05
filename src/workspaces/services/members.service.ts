import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { IWorkspaceMemberRepository } from '../../core/repositories/workspace-member.repository.interface';
import { IWorkspaceInviteRepository } from '../../core/repositories/workspace-invite.repository.interface';
import { IWorkspaceRepository } from '../../core/repositories/workspace.repository.interface';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ActivityService } from '../../activity/activity.service';
import { DRIZZLE } from '../../db/database.module';
import * as schema from '../../db/schema';
import { InviteRole } from '../../core/entities/workspace-invite.entity';
import { WorkspaceRole } from '../../core/entities/workspace-member.entity';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

@Injectable()
export class MembersService {
  constructor(
    @Inject(IWorkspaceMemberRepository)
    private readonly memberRepository: IWorkspaceMemberRepository,
    @Inject(IWorkspaceInviteRepository)
    private readonly inviteRepository: IWorkspaceInviteRepository,
    @Inject(IWorkspaceRepository)
    private readonly workspaceRepository: IWorkspaceRepository,
    private readonly notificationsService: NotificationsService,
    private readonly activityService: ActivityService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getMembers(workspaceId: string) {
    const members = await this.memberRepository.findAllByWorkspace(workspaceId);
    if (members.length === 0) return [];

    const userRows = await Promise.all(
      members.map((m) =>
        this.db
          .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, image: schema.user.image })
          .from(schema.user)
          .where(eq(schema.user.id, m.userId))
          .limit(1)
          .then((r) => r[0]),
      ),
    );

    const userMap = new Map(userRows.filter(Boolean).map((u) => [u.id, u]));

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt,
      user: userMap.get(m.userId) ?? null,
    }));
  }

  async inviteMember(
    workspaceId: string,
    invitedBy: string,
    email: string,
    role: InviteRole,
  ): Promise<void> {
    const requester = await this.memberRepository.findByWorkspaceAndUser(workspaceId, invitedBy);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      throw new ForbiddenException('Apenas owner ou admin podem convidar membros');
    }

    const existingUser = await this.db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1)
      .then((r) => r[0]);

    if (existingUser) {
      const alreadyMember = await this.memberRepository.findByWorkspaceAndUser(workspaceId, existingUser.id);
      if (alreadyMember) {
        throw new ConflictException('Este usuário já é membro deste workspace');
      }
    }

    const pendingInvite = await this.inviteRepository.findPendingByEmail(workspaceId, email);
    if (pendingInvite) {
      throw new ConflictException('Já existe um convite pendente para este email');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.inviteRepository.create({ workspaceId, invitedEmail: email, role, token, expiresAt, createdBy: invitedBy });

    const workspace = await this.workspaceRepository.findById(workspaceId);
    const inviter = await this.db
      .select({ name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.id, invitedBy))
      .limit(1)
      .then((r) => r[0]);

    try {
      await this.notificationsService.sendWorkspaceInvite({
        to: email,
        inviterName: inviter?.name ?? 'Alguém',
        workspaceName: workspace?.name ?? '',
        acceptUrl: `${FRONTEND_URL}/invites/${token}`,
      });
    } catch (err: unknown) {
      console.error('[MembersService] Failed to send invite email:', JSON.stringify(err));
    }

    this.activityService.log({
      workspaceId,
      userId: invitedBy,
      action: 'member.invited',
      entityType: 'member',
      entityId: workspaceId,
      metadata: { email, role },
    });
  }

  async getInviteByToken(token: string) {
    const invite = await this.inviteRepository.findByToken(token);
    if (!invite) throw new NotFoundException('Convite não encontrado');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Convite expirado');
    if (invite.acceptedAt) throw new BadRequestException('Convite já foi aceito');

    const workspace = await this.workspaceRepository.findById(invite.workspaceId);
    const inviter = await this.db
      .select({ name: schema.user.name })
      .from(schema.user)
      .where(eq(schema.user.id, invite.createdBy))
      .limit(1)
      .then((r) => r[0]);

    return {
      workspaceName: workspace?.name ?? '',
      invitedEmail: invite.invitedEmail,
      role: invite.role,
      inviterName: inviter?.name ?? '',
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(token: string, userId: string): Promise<void> {
    const invite = await this.inviteRepository.findByToken(token);
    if (!invite) throw new NotFoundException('Convite não encontrado');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Convite expirado');
    if (invite.acceptedAt) throw new BadRequestException('Convite já foi aceito');

    const alreadyMember = await this.memberRepository.findByWorkspaceAndUser(invite.workspaceId, userId);
    if (alreadyMember) throw new ConflictException('Você já é membro deste workspace');

    await this.db.transaction(async (trx) => {
      await this.memberRepository.create(
        { workspaceId: invite.workspaceId, userId, role: invite.role as WorkspaceRole },
        trx,
      );
      await this.inviteRepository.markAccepted(invite.id);
    });
  }

  async removeMember(workspaceId: string, memberId: string, requesterId: string): Promise<void> {
    const requester = await this.memberRepository.findByWorkspaceAndUser(workspaceId, requesterId);
    if (!requester || (requester.role !== 'owner' && requester.role !== 'admin')) {
      throw new ForbiddenException('Apenas owner ou admin podem remover membros');
    }

    const [target] = await this.db
      .select()
      .from(schema.workspaceMember)
      .where(eq(schema.workspaceMember.id, memberId))
      .limit(1);

    if (!target || target.workspaceId !== workspaceId) throw new NotFoundException('Membro não encontrado');
    if (target.role === 'owner') throw new ForbiddenException('Não é possível remover o owner do workspace');

    await this.memberRepository.remove(memberId);

    this.activityService.log({
      workspaceId,
      userId: requesterId,
      action: 'member.removed',
      entityType: 'member',
      entityId: memberId,
      metadata: { userId: target.userId },
    });
  }

  async updateMemberRole(workspaceId: string, memberId: string, newRole: InviteRole, requesterId: string): Promise<void> {
    const requester = await this.memberRepository.findByWorkspaceAndUser(workspaceId, requesterId);
    if (!requester || requester.role !== 'owner') {
      throw new ForbiddenException('Apenas o owner pode alterar roles');
    }

    const [target] = await this.db
      .select()
      .from(schema.workspaceMember)
      .where(eq(schema.workspaceMember.id, memberId))
      .limit(1);

    if (!target || target.workspaceId !== workspaceId) throw new NotFoundException('Membro não encontrado');
    if (target.role === 'owner') throw new ForbiddenException('Não é possível rebaixar o owner');

    await this.memberRepository.updateRole(memberId, newRole as WorkspaceRole);

    this.activityService.log({
      workspaceId,
      userId: requesterId,
      action: 'member.roleUpdated',
      entityType: 'member',
      entityId: memberId,
      metadata: { userId: target.userId, newRole },
    });
  }

  async leaveWorkspace(workspaceId: string, userId: string): Promise<void> {
    const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, userId);
    if (!member) throw new NotFoundException('Você não é membro deste workspace');
    if (member.role === 'owner') {
      throw new ForbiddenException('O owner não pode sair do workspace. Transfira a ownership primeiro.');
    }
    await this.memberRepository.remove(member.id);

    this.activityService.log({
      workspaceId,
      userId,
      action: 'member.left',
      entityType: 'member',
      entityId: member.id,
      metadata: {},
    });
  }
}
