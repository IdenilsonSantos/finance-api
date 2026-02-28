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
import { BankAccountsService } from '../services/bank-accounts.service';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from '../dto/bank-account.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@Controller('bank-accounts')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post()
  create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.bankAccountsService.create(dto, workspaceId);
  }

  @Get()
  findAll(@WorkspaceId() workspaceId: string) {
    return this.bankAccountsService.findAll(workspaceId);
  }

  @Get(':id')
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bankAccountsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankAccountsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bankAccountsService.remove(id, workspaceId);
  }
}
