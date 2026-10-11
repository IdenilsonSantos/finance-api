import { IsString, IsIn, IsOptional, IsInt, IsNumber, IsDateString, MaxLength } from 'class-validator';
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

  @ApiPropertyOptional({
    example: 100000,
    description: 'Saldo inicial em centavos (pode ser negativo, ex.: cheque especial)',
  })
  @IsOptional()
  @IsInt()
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

export class AdjustBalanceDto {
  @ApiProperty({ example: 1523.45, description: 'Novo saldo da conta (pode ser negativo)' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'balance must be a number with up to 2 decimal places' })
  balance!: number;

  @ApiPropertyOptional({ example: '2024-01-31', description: 'Data do ajuste (padrão: hoje)' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 'Conferência com o app do banco' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  description?: string;
}
