import { Injectable, Inject, NotFoundException } from '@nestjs/common';
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
    const updatedUser = await this.userRepository.update(id, updateUserDto);

    if (!updatedUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = updatedUser;
    return result as UserWithoutPassword;
  }
}
