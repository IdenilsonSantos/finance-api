import {
  Injectable,
  Inject,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from '../dto/auth.dto';
import { IUserRepository } from '../../core/repositories/user.repository.interface';
import { UserEntity } from '../../core/entities/user.entity';

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(IUserRepository) private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name }: RegisterDto = registerDto;

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Usuário com este e-mail já existe');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await this.userRepository.create({
      email,
      name,
      password: hashedPassword,
    });

    return this.generateToken(newUser);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password }: LoginDto = loginDto;

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.generateToken(user);
  }

  private generateToken(user: UserEntity): AuthResponse {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name ?? null,
        email: user.email,
      },
    };
  }
}
