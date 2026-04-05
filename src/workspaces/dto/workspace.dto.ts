import { IsString, IsNotEmpty, IsOptional, IsEmail, IsIn, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Meu Workspace' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'meu-workspace' })
  @IsString()
  @IsOptional()
  slug?: string;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Novo Nome' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsUrl()
  @IsOptional()
  image?: string;
}

export class InviteMemberDto {
  @ApiProperty({ example: 'membro@email.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ['admin', 'member'], default: 'member' })
  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member' = 'member';
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}
