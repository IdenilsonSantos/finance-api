import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransfersService } from '../services/transfers.service';
import { CreateTransferDto, ListTransfersDto } from '../dto/transfer.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@Controller('transfers')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  create(@WorkspaceId() workspaceId: string, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(dto, workspaceId);
  }

  @Get()
  findAll(@WorkspaceId() workspaceId: string, @Query() query: ListTransfersDto) {
    return this.transfersService.findAll(workspaceId, query);
  }

  @Get(':id')
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transfersService.findOne(id, workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transfersService.remove(id, workspaceId);
  }
}
