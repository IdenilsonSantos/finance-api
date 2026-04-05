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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TransfersService } from '../services/transfers.service';
import { CreateTransferDto, ListTransfersDto } from '../dto/transfer.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';

@ApiTags('Transfers')
@ApiBearerAuth('access-token')
@Controller('transfers')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a transfer between accounts' })
  @ApiResponse({ status: 201, description: 'Transfer created' })
  create(@WorkspaceId() workspaceId: string, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(dto, workspaceId);
  }

  @Get()
  @ApiOperation({ summary: 'List transfers with optional filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2024-01-01' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2024-01-31' })
  @ApiQuery({ name: 'accountId', required: false, type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Paginated list of transfers' })
  findAll(@WorkspaceId() workspaceId: string, @Query() query: ListTransfersDto) {
    return this.transfersService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transfer by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Transfer returned' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  findOne(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transfersService.findOne(id, workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a transfer' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Transfer deleted' })
  @ApiResponse({ status: 404, description: 'Transfer not found' })
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transfersService.remove(id, workspaceId);
  }
}
