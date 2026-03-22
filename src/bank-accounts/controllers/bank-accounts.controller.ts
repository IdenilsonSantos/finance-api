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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BankAccountsService } from '../services/bank-accounts.service';
import { StatementImportService } from '../services/statement-import.service';
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
  constructor(
    private readonly bankAccountsService: BankAccountsService,
    private readonly statementImportService: StatementImportService,
  ) {}

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

  @Post('import-statement')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  importStatementAuto(
    @WorkspaceId() workspaceId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('bankAccountId') bankAccountId?: string,
    @Body('force') force?: string,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.statementImportService.importOFX(
      bankAccountId ?? null,
      workspaceId,
      file.buffer,
      file.originalname,
      force === 'true',
    );
  }

  @Post(':id/statements/import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  importStatement(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) bankAccountId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.statementImportService.importOFX(
      bankAccountId,
      workspaceId,
      file.buffer,
    );
  }
}
