import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { WorkspaceGuard } from '../../workspaces/guards/workspace.guard';
import { WorkspaceId } from '../../workspaces/decorators/workspace-id.decorator';
import { CategoriesService } from '../services/categories.service';
import { CreateCategoryDto, DeleteCategoryQueryDto, UpdateCategoryDto } from '../dto/category.dto';

@ApiTags('Categories')
@ApiBearerAuth('access-token')
@Controller('categories')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List the custom categories of the workspace' })
  findAll(@WorkspaceId() workspaceId: string) {
    return this.categoriesService.findAll(workspaceId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a custom category' })
  @ApiResponse({ status: 409, description: 'A category with this name already exists' })
  create(@WorkspaceId() workspaceId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or restyle a custom category' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  update(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a custom category, moving its transactions to another one' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  remove(
    @WorkspaceId() workspaceId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DeleteCategoryQueryDto,
  ) {
    return this.categoriesService.remove(id, workspaceId, query);
  }
}
