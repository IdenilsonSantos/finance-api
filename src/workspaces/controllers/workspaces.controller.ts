import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkspacesService } from '../services/workspaces.service';
import { MembersService } from '../services/members.service';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from '../dto/workspace.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { WorkspaceGuard } from '../guards/workspace.guard';
import { WorkspaceId } from '../decorators/workspace-id.decorator';
import { WorkspaceMember } from '../decorators/workspace-member.decorator';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly membersService: MembersService,
  ) {}

  @Get('mine')
  findMine(@GetUser('userId') userId: string) {
    return this.workspacesService.findByUserId(userId);
  }

  @Post()
  create(@GetUser('userId') userId: string, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(dto, userId);
  }

  @Get(':id')
  @UseGuards(WorkspaceGuard)
  findOne(@WorkspaceId() workspaceId: string) {
    return this.workspacesService.findById(workspaceId);
  }

  @Patch(':id')
  @UseGuards(WorkspaceGuard)
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkspaceDto,
    @WorkspaceMember() member: { role: string },
  ) {
    if (member?.role === 'member') {
      throw new ForbiddenException('Apenas owner ou admin podem editar o workspace');
    }
    return this.workspacesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @GetUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const workspace = await this.workspacesService.findById(id);
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Apenas o dono pode excluir o workspace');
    }
    return this.workspacesService.delete(id);
  }

  // ── Members ──────────────────────────────────────────────────────────────

  @Get(':id/members')
  @UseGuards(WorkspaceGuard)
  getMembers(@WorkspaceId() workspaceId: string) {
    return this.membersService.getMembers(workspaceId);
  }

  @Post(':id/members/invite')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  inviteMember(
    @WorkspaceId() workspaceId: string,
    @GetUser('userId') userId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.membersService.inviteMember(workspaceId, userId, dto.email, dto.role ?? 'member');
  }

  @Delete(':id/members/:memberId')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @WorkspaceId() workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @GetUser('userId') userId: string,
  ) {
    return this.membersService.removeMember(workspaceId, memberId, userId);
  }

  @Patch(':id/members/:memberId')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  updateMemberRole(
    @WorkspaceId() workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @GetUser('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateMemberRole(workspaceId, memberId, dto.role, userId);
  }

  @Post(':id/leave')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  leaveWorkspace(
    @WorkspaceId() workspaceId: string,
    @GetUser('userId') userId: string,
  ) {
    return this.membersService.leaveWorkspace(workspaceId, userId);
  }
}
