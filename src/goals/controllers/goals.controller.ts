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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { GoalsService } from '../services/goals.service';
import { CreateGoalDto, UpdateGoalDto, ContributeGoalDto, ListGoalsDto } from '../dto/goal.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@ApiTags('Goals')
@ApiBearerAuth('access-token')
@Controller('goals')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a financial goal' })
  @ApiResponse({ status: 201, description: 'Goal created' })
  create(@WorkspaceId() workspaceId: string, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(dto, workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List goals with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'completed', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated list of goals' })
  findAll(@WorkspaceId() workspaceId: string, @Query() query: ListGoalsDto) {
    return this.goalsService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get goal by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Goal returned' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a goal' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Goal updated' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a goal' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Goal deleted' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.remove(id, workspaceId);
  }

  @Post(':id/contribute')
  @ApiOperation({ summary: 'Add a contribution to a goal' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Contribution added' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  contribute(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContributeGoalDto,
  ) {
    return this.goalsService.contribute(id, workspaceId, dto);
  }
}
