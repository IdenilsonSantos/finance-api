import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { WorkspacesService } from './services/workspaces.service';
import { MembersService } from './services/members.service';
import { WorkspacesController } from './controllers/workspaces.controller';
import { InvitesController } from './controllers/invites.controller';
import { WorkspaceGuard } from './guards/workspace.guard';
import { IWorkspaceRepository } from '../core/repositories/workspace.repository.interface';
import { DrizzleWorkspaceRepository } from '../infrastructure/database/drizzle/repositories/drizzle-workspace.repository';
import { IWorkspaceMemberRepository } from '../core/repositories/workspace-member.repository.interface';
import { DrizzleWorkspaceMemberRepository } from '../infrastructure/database/drizzle/repositories/drizzle-workspace-member.repository';
import { IWorkspaceInviteRepository } from '../core/repositories/workspace-invite.repository.interface';
import { DrizzleWorkspaceInviteRepository } from '../infrastructure/database/drizzle/repositories/drizzle-workspace-invite.repository';

@Module({
  imports: [AuthModule, NotificationsModule, ActivityModule],
  providers: [
    WorkspacesService,
    MembersService,
    WorkspaceGuard,
    { provide: IWorkspaceRepository, useClass: DrizzleWorkspaceRepository },
    { provide: IWorkspaceMemberRepository, useClass: DrizzleWorkspaceMemberRepository },
    { provide: IWorkspaceInviteRepository, useClass: DrizzleWorkspaceInviteRepository },
  ],
  controllers: [WorkspacesController, InvitesController],
  exports: [WorkspacesService, WorkspaceGuard, AuthModule, IWorkspaceMemberRepository],
})
export class WorkspacesModule {}
