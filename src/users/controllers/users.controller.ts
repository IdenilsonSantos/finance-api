import { Controller, Patch, Body, UseGuards, Get } from '@nestjs/common';
import { UsersService, UserWithoutPassword } from '../services/users.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(
    @GetUser() user: { userId: string },
  ): Promise<UserWithoutPassword> {
    const userProfile = await this.usersService.findById(user.userId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = userProfile;
    return result;
  }

  @Patch('me')
  async updateMe(
    @GetUser() user: { userId: string },
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserWithoutPassword> {
    return this.usersService.update(user.userId, updateUserDto);
  }
}
