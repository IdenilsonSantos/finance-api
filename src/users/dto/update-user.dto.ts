import { IsEmail, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'João Silva' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({ example: 'senhaAtual123' })
  @IsString()
  @IsOptional()
  currentPassword?: string;

  @ApiPropertyOptional({ example: 'novaSenha123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsOptional()
  newPassword?: string;
}
