import {
  IsString,
  IsIn,
  IsNumber,
  IsPositive,
  IsDateString,
  IsUUID,
  IsOptional,
} from 'class-validator';
import type { TransactionType } from '../../core/entities/transaction.entity';
import type { ScheduledTransactionFrequency } from '../../core/entities/scheduled-transaction.entity';
import { PaginationDto } from '../../core/dto/pagination.dto';

export class ListScheduledTransactionsDto extends PaginationDto {
  @IsOptional()
  @IsIn(['once', 'daily', 'weekly', 'monthly', 'yearly'])
  frequency?: ScheduledTransactionFrequency;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class CreateScheduledTransactionDto {
  @IsUUID()
  bankAccountId: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount: number;

  @IsIn(['income', 'expense'], {
    message: 'type must be one of the following values: income, expense',
  })
  type: TransactionType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category: string;

  @IsIn(['once', 'daily', 'weekly', 'monthly', 'yearly'], {
    message: 'frequency must be one of the following values: once, daily, weekly, monthly, yearly',
  })
  frequency: ScheduledTransactionFrequency;

  @IsDateString()
  nextDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateScheduledTransactionDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: TransactionType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['once', 'daily', 'weekly', 'monthly', 'yearly'])
  frequency?: ScheduledTransactionFrequency;

  @IsOptional()
  @IsDateString()
  nextDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
