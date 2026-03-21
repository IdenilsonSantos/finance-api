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
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../dto/workspace.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { WorkspaceGuard } from '../guards/workspace.guard';
import { WorkspaceId } from '../decorators/workspace-id.decorator';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

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
  ) {
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
}
