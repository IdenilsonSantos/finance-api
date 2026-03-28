import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GoalsService } from '../services/goals.service';
import { CreateGoalDto, UpdateGoalDto, ContributeGoalDto, ListGoalsDto } from '../dto/goal.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@Controller('goals')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@WorkspaceId() workspaceId: string, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(dto, workspaceId);
  }

  @Get()
  findAll(@WorkspaceId() workspaceId: string, @Query() query: ListGoalsDto) {
    return this.goalsService.findAll(workspaceId, query);
  }

  @Get(':id')
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.remove(id, workspaceId);
  }

  @Post(':id/contribute')
  contribute(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContributeGoalDto,
  ) {
    return this.goalsService.contribute(id, workspaceId, dto);
  }
}
