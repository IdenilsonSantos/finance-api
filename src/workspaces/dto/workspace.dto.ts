import { IsString, IsNotEmpty, IsOptional, IsEmail, IsIn, IsUrl } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;
}

export class UpdateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsUrl()
  @IsOptional()
  image?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member' = 'member';
}

export class UpdateMemberRoleDto {
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}
