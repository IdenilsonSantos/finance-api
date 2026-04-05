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
import { TransactionsService } from '../services/transactions.service';
import { CreateTransactionDto, UpdateTransactionDto, ListTransactionsDto } from '../dto/transaction.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@Controller('transactions')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a transaction' })
  @ApiResponse({ status: 201, description: 'Transaction created' })
  create(
    @WorkspaceId() workspaceId: string,
    @GetUser('userId') userId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(dto, workspaceId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List transactions with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: ['income', 'expense'] })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'accountId', required: false, type: String, format: 'uuid' })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2024-01-31' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  findAll(@WorkspaceId() workspaceId: string, @Query() query: ListTransactionsDto) {
    return this.transactionsService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Transaction returned' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Transaction updated' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('userId') userId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, workspaceId, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Transaction deleted' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('userId') userId: string,
  ) {
    return this.transactionsService.remove(id, workspaceId, userId);
  }
}
