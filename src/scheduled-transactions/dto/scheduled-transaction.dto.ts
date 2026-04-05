import {
  IsString,
  IsIn,
  IsNumber,
  IsPositive,
  IsDateString,
  IsUUID,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TransactionType } from '../../core/entities/transaction.entity';
import type { ScheduledTransactionFrequency } from '../../core/entities/scheduled-transaction.entity';
import { PaginationDto } from '../../core/dto/pagination.dto';

export class ListScheduledTransactionsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'] })
  @IsOptional()
  @IsIn(['once', 'daily', 'weekly', 'monthly', 'yearly'])
  frequency?: ScheduledTransactionFrequency;

  @ApiPropertyOptional({ example: 'uuid-da-conta', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class CreateScheduledTransactionDto {
  @ApiProperty({ example: 'uuid-da-conta', format: 'uuid' })
  @IsUUID()
  bankAccountId!: string;

  @ApiProperty({ example: 1500.0, description: 'Valor com até 2 casas decimais' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: ['income', 'expense'], example: 'income' })
  @IsIn(['income', 'expense'], {
    message: 'type must be one of the following values: income, expense',
  })
  type!: TransactionType;

  @ApiPropertyOptional({ example: 'Salário mensal' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Salário' })
  @IsString()
  category!: string;

  @ApiProperty({ enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'], example: 'monthly' })
  @IsIn(['once', 'daily', 'weekly', 'monthly', 'yearly'], {
    message: 'frequency must be one of the following values: once, daily, weekly, monthly, yearly',
  })
  frequency!: ScheduledTransactionFrequency;

  @ApiProperty({ example: '2024-02-01' })
  @IsDateString()
  nextDate!: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateScheduledTransactionDto {
  @ApiPropertyOptional({ example: 2000.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ enum: ['income', 'expense'] })
  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: TransactionType;

  @ApiPropertyOptional({ example: 'Salário reajustado' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Salário' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'] })
  @IsOptional()
  @IsIn(['once', 'daily', 'weekly', 'monthly', 'yearly'])
  frequency?: ScheduledTransactionFrequency;

  @ApiPropertyOptional({ example: '2024-03-01' })
  @IsOptional()
  @IsDateString()
  nextDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
