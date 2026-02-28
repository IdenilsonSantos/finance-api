import { IsString, IsIn, IsOptional, IsInt, Min } from 'class-validator';
import type { BankAccountType } from '../../core/entities/bank-account.entity';

export class CreateBankAccountDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['checking', 'savings', 'investment', 'cash'], {
    message:
      'type must be one of the following values: checking, savings, investment, cash',
  })
  type?: BankAccountType;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialBalance?: number;
}

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['checking', 'savings', 'investment', 'cash'], {
    message:
      'type must be one of the following values: checking, savings, investment, cash',
  })
  type?: BankAccountType;

  @IsOptional()
  @IsString()
  color?: string;
}
