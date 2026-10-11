import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { CategoriesService } from './services/categories.service';
import { CategoriesController } from './controllers/categories.controller';

@Module({
  imports: [WorkspacesModule],
  providers: [CategoriesService, WorkspaceGuard],
  controllers: [CategoriesController],
  exports: [CategoriesService],
})
export class CategoriesModule {}
