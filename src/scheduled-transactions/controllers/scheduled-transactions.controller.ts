import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ScheduledTransactionsService } from '../services/scheduled-transactions.service';
import {
  CreateScheduledTransactionDto,
  UpdateScheduledTransactionDto,
} from '../dto/scheduled-transaction.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@Controller('scheduled-transactions')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ScheduledTransactionsController {
  constructor(
    private readonly scheduledTransactionsService: ScheduledTransactionsService,
  ) {}

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateScheduledTransactionDto,
  ) {
    return this.scheduledTransactionsService.create(dto, workspaceId);
  }

  @Get()
  findAll(@WorkspaceId() workspaceId: string) {
    return this.scheduledTransactionsService.findAll(workspaceId);
  }

  @Get(':id')
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduledTransactionsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduledTransactionDto,
  ) {
    return this.scheduledTransactionsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduledTransactionsService.remove(id, workspaceId);
  }

  @Post(':id/execute')
  async execute(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const result = await this.scheduledTransactionsService.execute(id, workspaceId);
    if (result === null) {
      res.status(HttpStatus.NO_CONTENT).send();
    } else {
      res.status(HttpStatus.OK).json(result);
    }
  }
}
