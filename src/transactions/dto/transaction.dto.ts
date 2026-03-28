import { IsString, IsIn, IsNumber, IsPositive, IsDateString, IsUUID, IsOptional, ValidateIf } from 'class-validator';
import type { TransactionType } from '../../core/entities/transaction.entity';
import { PaginationDto } from '../../core/dto/pagination.dto';

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

  @IsOptional()
  @IsString()
  beneficiary?: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsDateString()
  date: string;
}

export class ListTransactionsDto extends PaginationDto {
  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: TransactionType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;
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
  @ValidateIf((o) => o.description !== null)
  @IsString()
  description?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.beneficiary !== null)
  @IsString()
  beneficiary?: string | null;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @ValidateIf((o) => o.paymentMethod !== null)
  @IsString()
  paymentMethod?: string | null;

  @IsOptional()
  @IsDateString()
  date?: string;
}
