import { IsString, IsIn, IsNumber, IsPositive, IsDateString, IsUUID, IsOptional, ValidateIf } from 'class-validator';
import type { TransactionType } from '../../core/entities/transaction.entity';

export class CreateTransactionDto {
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

  @IsDateString()
  date: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  @ValidateIf((o) => o.amount !== undefined)
  amount?: number;

  @IsOptional()
  @IsIn(['income', 'expense'], {
    message: 'type must be one of the following values: income, expense',
  })
  type?: TransactionType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
