import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MembersService } from '../services/members.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@Controller('workspaces/invites')
export class InvitesController {
  constructor(private readonly membersService: MembersService) {}

  /** Público — frontend exibe info do convite antes do login */
  @Get(':token')
  getInvite(@Param('token') token: string) {
    return this.membersService.getInviteByToken(token);
  }

  /** Requer JWT — usuário precisa estar logado para aceitar */
  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  acceptInvite(
    @Param('token') token: string,
    @GetUser('userId') userId: string,
  ) {
    return this.membersService.acceptInvite(token, userId);
  }
}
