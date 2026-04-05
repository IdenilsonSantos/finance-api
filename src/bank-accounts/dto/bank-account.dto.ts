import { IsString, IsIn, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BankAccountType } from '../../core/entities/bank-account.entity';

export class CreateBankAccountDto {
  @ApiProperty({ example: 'Conta Corrente Nubank' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: ['checking', 'savings', 'investment', 'cash'], example: 'checking' })
  @IsOptional()
  @IsIn(['checking', 'savings', 'investment', 'cash'], {
    message:
      'type must be one of the following values: checking, savings, investment, cash',
  })
  type?: BankAccountType;

  @ApiPropertyOptional({ example: '#6366f1' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 100000, description: 'Saldo inicial em centavos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialBalance?: number;
}

export class UpdateBankAccountDto {
  @ApiPropertyOptional({ example: 'Conta Poupança' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['checking', 'savings', 'investment', 'cash'], example: 'savings' })
  @IsOptional()
  @IsIn(['checking', 'savings', 'investment', 'cash'], {
    message:
      'type must be one of the following values: checking, savings, investment, cash',
  })
  type?: BankAccountType;

  @ApiPropertyOptional({ example: '#22c55e' })
  @IsOptional()
  @IsString()
  color?: string;
}
