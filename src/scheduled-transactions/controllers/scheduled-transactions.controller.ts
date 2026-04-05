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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ScheduledTransactionsService } from '../services/scheduled-transactions.service';
import {
  CreateScheduledTransactionDto,
  UpdateScheduledTransactionDto,
  ListScheduledTransactionsDto,
} from '../dto/scheduled-transaction.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@ApiTags('Scheduled Transactions')
@ApiBearerAuth('access-token')
@Controller('scheduled-transactions')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ScheduledTransactionsController {
  constructor(
    private readonly scheduledTransactionsService: ScheduledTransactionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a scheduled transaction' })
  @ApiResponse({ status: 201, description: 'Scheduled transaction created' })
  create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateScheduledTransactionDto,
  ) {
    return this.scheduledTransactionsService.create(dto, workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List scheduled transactions with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'frequency', required: false, enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'] })
  @ApiQuery({ name: 'accountId', required: false, type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Paginated list of scheduled transactions' })
  findAll(@WorkspaceId() workspaceId: string, @Query() query: ListScheduledTransactionsDto) {
    return this.scheduledTransactionsService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get scheduled transaction by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Scheduled transaction returned' })
  @ApiResponse({ status: 404, description: 'Scheduled transaction not found' })
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduledTransactionsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a scheduled transaction' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Scheduled transaction updated' })
  @ApiResponse({ status: 404, description: 'Scheduled transaction not found' })
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduledTransactionDto,
  ) {
    return this.scheduledTransactionsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a scheduled transaction' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Scheduled transaction deleted' })
  @ApiResponse({ status: 404, description: 'Scheduled transaction not found' })
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.scheduledTransactionsService.remove(id, workspaceId);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Manually execute a scheduled transaction' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Transaction created from scheduled' })
  @ApiResponse({ status: 204, description: 'Already executed / end date reached' })
  @ApiResponse({ status: 404, description: 'Scheduled transaction not found' })
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
