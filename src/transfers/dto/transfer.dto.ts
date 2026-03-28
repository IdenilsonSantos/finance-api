import { IsString, IsNumber, IsPositive, IsDateString, IsUUID, IsOptional } from 'class-validator';
import { PaginationDto } from '../../core/dto/pagination.dto';

export class ListTransfersDto extends PaginationDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class CreateTransferDto {
  @IsUUID()
  fromAccountId: string;

  @IsUUID()
  toAccountId: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date: string;
}
