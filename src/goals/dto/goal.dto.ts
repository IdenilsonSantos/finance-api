import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetAmount must be a number with up to 2 decimal places' })
  @IsPositive()
  targetAmount: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'targetAmount must be a number with up to 2 decimal places' })
  @IsPositive()
  targetAmount?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class ContributeGoalDto {
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a number with up to 2 decimal places' })
  @IsPositive()
  amount: number;
}
