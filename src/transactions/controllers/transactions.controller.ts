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
} from '@nestjs/common';
import { TransactionsService } from '../services/transactions.service';
import { CreateTransactionDto, UpdateTransactionDto } from '../dto/transaction.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@Controller('transactions')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@WorkspaceId() workspaceId: string, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(dto, workspaceId);
  }

  @Get()
  findAll(@WorkspaceId() workspaceId: string) {
    return this.transactionsService.findAll(workspaceId);
  }

  @Get(':id')
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.remove(id, workspaceId);
  }
}
