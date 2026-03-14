import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from '../dto/update-user.dto';
import { IUserRepository } from '../../core/repositories/user.repository.interface';
import { UserEntity } from '../../core/entities/user.entity';

export type UserWithoutPassword = Omit<UserEntity, 'password'>;

@Injectable()
export class UsersService {
  constructor(
    @Inject(IUserRepository) private readonly userRepository: IUserRepository,
  ) {}

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserWithoutPassword> {
    const { currentPassword, newPassword, ...fields } = updateUserDto;

    const payload: Partial<UserEntity> = { ...fields };

    if (newPassword) {
      if (!currentPassword) {
        throw new BadRequestException('Informe a senha atual para alterá-la');
      }

      const user = await this.findById(id);
      const valid = await bcrypt.compare(currentPassword, user.password);

      if (!valid) {
        throw new UnauthorizedException('Senha atual incorreta');
      }

      payload.password = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await this.userRepository.update(id, payload);

    if (!updatedUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = updatedUser;
    return result as UserWithoutPassword;
  }
}
