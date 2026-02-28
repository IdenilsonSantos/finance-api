import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesService } from './services/workspaces.service';
import { WorkspacesController } from './controllers/workspaces.controller';
import { WorkspaceGuard } from './guards/workspace.guard';

@Module({
  imports: [AuthModule],
  providers: [WorkspacesService, WorkspaceGuard],
  controllers: [WorkspacesController],
  exports: [WorkspacesService, WorkspaceGuard],
})
export class WorkspacesModule {}
