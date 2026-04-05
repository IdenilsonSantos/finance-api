import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../core/dto/pagination.dto';

export class ListGoalsDto extends PaginationDto {
  @ApiPropertyOptional({ example: false, description: 'Filtrar por metas concluídas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  completed?: boolean;
}

export class CreateGoalDto {
  @ApiProperty({ example: 'Fundo de emergência' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 10000.0, description: 'Valor alvo com até 2 casas decimais' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetAmount must be a number with up to 2 decimal places' })
  @IsPositive()
  targetAmount!: number;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: '#f59e0b' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateGoalDto {
  @ApiPropertyOptional({ example: 'Reserva de emergência' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 15000.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetAmount must be a number with up to 2 decimal places' })
  @IsPositive()
  targetAmount?: number;

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: '#10b981' })
  @IsOptional()
  @IsString()
  color?: string;
}

export class ContributeGoalDto {
  @ApiProperty({ example: 500.0, description: 'Valor a contribuir com até 2 casas decimais' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount!: number;
}
