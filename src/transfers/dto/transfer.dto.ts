import { IsString, IsNumber, IsPositive, IsDateString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../core/dto/pagination.dto';

export class ListTransfersDto extends PaginationDto {
  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'uuid-da-conta', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class CreateTransferDto {
  @ApiProperty({ example: 'uuid-conta-origem', format: 'uuid' })
  @IsUUID()
  fromAccountId!: string;

  @ApiProperty({ example: 'uuid-conta-destino', format: 'uuid' })
  @IsUUID()
  toAccountId!: string;

  @ApiProperty({ example: 500.0, description: 'Valor com até 2 casas decimais' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 'Transferência para reserva' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date!: string;
}
