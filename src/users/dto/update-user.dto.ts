import { IsEmail, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsUrl()
  @IsOptional()
  image?: string;

  @IsString()
  @IsOptional()
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  @IsOptional()
  newPassword?: string;
}
