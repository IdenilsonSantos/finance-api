import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Ícones disponíveis (nomes mapeados para ícones no app). */
export const CATEGORY_ICONS = [
  'tag',
  'shopping-bag',
  'shopping-cart',
  'home',
  'car',
  'heart',
  'gift',
  'paw-print',
  'plane',
  'coffee',
  'gamepad',
  'book',
  'briefcase',
  'piggy-bank',
  'smartphone',
  'dumbbell',
  'baby',
  'wrench',
  'music',
  'receipt',
] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateCategoryDto {
  @ApiProperty({ example: 'Pets' })
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  name!: string;

  @ApiProperty({ enum: ['income', 'expense'] })
  @IsIn(['income', 'expense'])
  type!: 'income' | 'expense';

  @ApiPropertyOptional({ example: '#f97316' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex color like #f97316' })
  color?: string;

  @ApiPropertyOptional({ enum: CATEGORY_ICONS })
  @IsOptional()
  @IsIn(CATEGORY_ICONS)
  icon?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 'Pets e veterinário' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  name?: string;

  @ApiPropertyOptional({ example: '#f97316' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a hex color like #f97316' })
  color?: string;

  @ApiPropertyOptional({ enum: CATEGORY_ICONS })
  @IsOptional()
  @IsIn(CATEGORY_ICONS)
  icon?: string;
}

export class DeleteCategoryQueryDto {
  @ApiPropertyOptional({
    example: 'others',
    description: 'Categoria (padrão ou personalizada) que recebe os lançamentos. Padrão: others',
  })
  @IsOptional()
  @IsString()
  replaceWith?: string;
}
