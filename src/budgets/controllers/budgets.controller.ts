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
import { BudgetsService } from '../services/budgets.service';
import { CreateBudgetDto, UpdateBudgetDto } from '../dto/budget.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@Controller('budgets')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(@WorkspaceId() workspaceId: string, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(dto, workspaceId);
  }

  // CRÍTICO: /summary deve vir ANTES de /:id
  @Get('summary')
  getSummary(
    @WorkspaceId() workspaceId: string,
    @Query('month') month: string,
  ) {
    return this.budgetsService.getSummary(workspaceId, month);
  }

  @Get()
  findAll(
    @WorkspaceId() workspaceId: string,
    @Query('month') month?: string,
  ) {
    return this.budgetsService.findAll(workspaceId, month);
  }

  @Get(':id')
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.budgetsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.budgetsService.remove(id, workspaceId);
  }
}
