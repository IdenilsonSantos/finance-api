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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { BankAccountsService } from '../services/bank-accounts.service';
import { StatementImportService } from '../services/statement-import.service';
import {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from '../dto/bank-account.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('Bank Accounts')
@ApiBearerAuth('access-token')
@Controller('bank-accounts')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class BankAccountsController {
  constructor(
    private readonly bankAccountsService: BankAccountsService,
    private readonly statementImportService: StatementImportService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a bank account' })
  @ApiResponse({ status: 201, description: 'Bank account created' })
  create(
    @WorkspaceId() workspaceId: string,
    @GetUser('userId') userId: string,
    @Body() dto: CreateBankAccountDto,
  ) {
    return this.bankAccountsService.create(dto, workspaceId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all bank accounts in the workspace' })
  @ApiResponse({ status: 200, description: 'List of bank accounts returned' })
  findAll(@WorkspaceId() workspaceId: string) {
    return this.bankAccountsService.findAll(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bank account by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Bank account returned' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bankAccountsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update bank account' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Bank account updated' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('userId') userId: string,
    @Body() dto: UpdateBankAccountDto,
  ) {
    return this.bankAccountsService.update(id, workspaceId, dto, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete bank account' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Bank account deleted' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser('userId') userId: string,
  ) {
    return this.bankAccountsService.remove(id, workspaceId, userId);
  }

  @Post('import-statement')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Import OFX/PDF statement (auto-detect account)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        bankAccountId: { type: 'string', format: 'uuid' },
        force: { type: 'string', example: 'false' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Statement imported successfully' })
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
  @ApiOperation({ summary: 'Import OFX statement into a specific bank account' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Statement imported successfully' })
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
