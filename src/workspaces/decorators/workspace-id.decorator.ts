import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const WorkspaceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.headers['x-workspace-id'] as string;
  },
);
