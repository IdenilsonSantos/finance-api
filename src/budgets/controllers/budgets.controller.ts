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
import { BudgetsService } from '../services/budgets.service';
import { CreateBudgetDto, UpdateBudgetDto } from '../dto/budget.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('Budgets')
@ApiBearerAuth('access-token')
@Controller('budgets')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a budget for a category/month' })
  @ApiResponse({ status: 201, description: 'Budget created' })
  @ApiResponse({ status: 409, description: 'Budget already exists for this category/month' })
  create(
    @WorkspaceId() workspaceId: string,
    @GetUser('userId') userId: string,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.budgetsService.create(dto, workspaceId, userId);
  }

  // CRÍTICO: /summary deve vir ANTES de /:id
  @Get('summary')
  @ApiOperation({ summary: 'Get budget summary with spent amounts for a month' })
  @ApiQuery({ name: 'month', required: true, type: String, example: '2024-01', description: 'Month in YYYY-MM format' })
  @ApiResponse({ status: 200, description: 'Budget summary returned' })
  getSummary(
    @WorkspaceId() workspaceId: string,
    @Query('month') month: string,
  ) {
    return this.budgetsService.getSummary(workspaceId, month);
  }

  @Get()
  @ApiOperation({ summary: 'List budgets, optionally filtered by month' })
  @ApiQuery({ name: 'month', required: false, type: String, example: '2024-01' })
  @ApiResponse({ status: 200, description: 'List of budgets returned' })
  findAll(
    @WorkspaceId() workspaceId: string,
    @Query('month') month?: string,
  ) {
    return this.budgetsService.findAll(workspaceId, month);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budget by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Budget returned' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.budgetsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update budget amount' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Budget updated' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('userId') userId: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, workspaceId, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Budget deleted' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('userId') userId: string,
  ) {
    return this.budgetsService.remove(id, workspaceId, userId);
  }
}
