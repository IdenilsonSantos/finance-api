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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
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

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly membersService: MembersService,
  ) {}

  @Get('mine')
  @ApiOperation({ summary: 'List workspaces the user belongs to' })
  @ApiResponse({ status: 200, description: 'List of workspaces returned' })
  findMine(@GetUser('userId') userId: string) {
    return this.workspacesService.findByUserId(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  create(@GetUser('userId') userId: string, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create(dto, userId);
  }

  @Get(':id')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Get workspace by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Workspace returned' })
  @ApiResponse({ status: 403, description: 'Not a member of this workspace' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  findOne(@WorkspaceId() workspaceId: string) {
    return this.workspacesService.findById(workspaceId);
  }

  @Patch(':id')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Update workspace' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  @ApiResponse({ status: 403, description: 'Only owner or admin can edit' })
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
  @ApiOperation({ summary: 'Delete workspace (owner only)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Workspace deleted' })
  @ApiResponse({ status: 403, description: 'Only owner can delete' })
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
  @ApiOperation({ summary: 'List workspace members' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Members list returned' })
  getMembers(@WorkspaceId() workspaceId: string) {
    return this.membersService.getMembers(workspaceId);
  }

  @Post(':id/members/invite')
  @UseGuards(WorkspaceGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invite a member to workspace' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Invite sent' })
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
  @ApiOperation({ summary: 'Remove a member from workspace' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'memberId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Member removed' })
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
  @ApiOperation({ summary: 'Update member role' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'memberId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Role updated' })
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
  @ApiOperation({ summary: 'Leave workspace' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Left workspace' })
  leaveWorkspace(
    @WorkspaceId() workspaceId: string,
    @GetUser('userId') userId: string,
  ) {
    return this.membersService.leaveWorkspace(workspaceId, userId);
  }
}
