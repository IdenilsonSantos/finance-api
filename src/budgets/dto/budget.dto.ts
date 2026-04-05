import { IsString, IsNumber, IsPositive, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBudgetDto {
  @ApiProperty({ example: 'Alimentação' })
  @IsString()
  category!: string;

  @ApiProperty({ example: 800.0, description: 'Valor com até 2 casas decimais' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: '2024-01', description: 'Mês no formato YYYY-MM' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month!: string;
}

export class UpdateBudgetDto {
  @ApiPropertyOptional({ example: 1000.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount?: number;
}
