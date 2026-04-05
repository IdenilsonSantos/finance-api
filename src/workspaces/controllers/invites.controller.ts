import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { MembersService } from '../services/members.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('Workspaces')
@Controller('workspaces/invites')
export class InvitesController {
  constructor(private readonly membersService: MembersService) {}

  /** Público — frontend exibe info do convite antes do login */
  @Get(':token')
  @ApiOperation({ summary: 'Get invite info by token (public)' })
  @ApiParam({ name: 'token', type: 'string' })
  @ApiResponse({ status: 200, description: 'Invite details returned' })
  @ApiResponse({ status: 404, description: 'Invite not found or expired' })
  getInvite(@Param('token') token: string) {
    return this.membersService.getInviteByToken(token);
  }

  /** Requer JWT — usuário precisa estar logado para aceitar */
  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Accept workspace invite' })
  @ApiParam({ name: 'token', type: 'string' })
  @ApiResponse({ status: 204, description: 'Invite accepted' })
  @ApiResponse({ status: 404, description: 'Invite not found or expired' })
  acceptInvite(
    @Param('token') token: string,
    @GetUser('userId') userId: string,
  ) {
    return this.membersService.acceptInvite(token, userId);
  }
}
