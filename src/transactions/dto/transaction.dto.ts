import { IsString, IsIn, IsNumber, IsPositive, IsDateString, IsUUID, IsOptional, IsInt, Min, Max, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { TransactionType } from '../../core/entities/transaction.entity';
import { PaginationDto } from '../../core/dto/pagination.dto';

export class CreateTransactionDto {
  @ApiProperty({ example: 'uuid-da-conta', format: 'uuid' })
  @IsUUID()
  bankAccountId!: string;

  @ApiProperty({ example: 99.9, description: 'Valor com até 2 casas decimais' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: ['income', 'expense'], example: 'expense' })
  @IsIn(['income', 'expense'], {
    message: 'type must be one of the following values: income, expense',
  })
  type!: TransactionType;

  @ApiPropertyOptional({ example: 'Supermercado Extra' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Extra Hipermercados' })
  @IsOptional()
  @IsString()
  beneficiary?: string;

  @ApiProperty({ example: 'Alimentação' })
  @IsString()
  category!: string;

  @ApiPropertyOptional({ example: 'credit_card' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date!: string;
}

export class ListTransactionsDto extends PaginationDto {
  // Sobrescreve o limite padrão (máx. 100): o front usa um limit maior
  // (500) para calcular os totais de receitas/despesas do mês nos cards
  // da tela de transações, sem paginar essa consulta.
  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['income', 'expense'] })
  @IsOptional()
  @IsIn(['income', 'expense'])
  type?: TransactionType;

  @ApiPropertyOptional({ example: 'Alimentação' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'uuid-da-conta', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'supermercado' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateTransactionDto {
  @ApiPropertyOptional({ example: 'uuid-da-conta', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional({ example: 49.9 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  @ValidateIf((o) => o.amount !== undefined)
  amount?: number;

  @ApiPropertyOptional({ enum: ['income', 'expense'] })
  @IsOptional()
  @IsIn(['income', 'expense'], {
    message: 'type must be one of the following values: income, expense',
  })
  type?: TransactionType;

  @ApiPropertyOptional({ example: 'Farmácia', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.description !== null)
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 'Drogasil', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.beneficiary !== null)
  @IsString()
  beneficiary?: string | null;

  @ApiPropertyOptional({ example: 'Saúde' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'debit_card', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.paymentMethod !== null)
  @IsString()
  paymentMethod?: string | null;

  @ApiPropertyOptional({ example: '2024-01-20' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
