import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
}
