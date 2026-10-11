import {
  IsString,
  IsIn,
  IsOptional,
  IsInt,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
  Max,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BANK_ACCOUNT_TYPES,
  type BankAccountType,
} from '../../core/entities/bank-account.entity';

const TYPE_MESSAGE = `type must be one of the following values: ${BANK_ACCOUNT_TYPES.join(', ')}`;

export class CreateBankAccountDto {
  @ApiProperty({ example: 'Conta Corrente Nubank' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: BANK_ACCOUNT_TYPES, example: 'checking' })
  @IsOptional()
  @IsIn(BANK_ACCOUNT_TYPES, { message: TYPE_MESSAGE })
  type?: BankAccountType;

  @ApiPropertyOptional({ example: '#6366f1' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    example: 100000,
    description:
      'Saldo inicial em centavos (pode ser negativo, ex.: cheque especial ou fatura em aberto do cartão)',
  })
  @IsOptional()
  @IsInt()
  initialBalance?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Cartão de crédito: limite em centavos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: 25, description: 'Cartão de crédito: dia do fechamento (1-31)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay?: number;

  @ApiPropertyOptional({ example: 5, description: 'Cartão de crédito: dia do vencimento (1-31)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;
}

export class UpdateBankAccountDto {
  @ApiPropertyOptional({ example: 'Conta Poupança' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: BANK_ACCOUNT_TYPES, example: 'savings' })
  @IsOptional()
  @IsIn(BANK_ACCOUNT_TYPES, { message: TYPE_MESSAGE })
  type?: BankAccountType;

  @ApiPropertyOptional({ example: '#22c55e' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 500000, nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.creditLimit !== null)
  @IsInt()
  @Min(0)
  creditLimit?: number | null;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  closingDay?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;
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

export class InvoiceQueryDto {
  @ApiPropertyOptional({
    example: '2024-02',
    description: 'Mês da fatura (mês do vencimento), YYYY-MM. Padrão: fatura em aberto.',
  })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be in YYYY-MM format' })
  month?: string;
}
