import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPrefsDto {
  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  goalAchieved?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  goalDeadline?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  scheduledReminder?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  transferCreated?: boolean;
}

export type NotifPrefs = Required<UpdateNotificationPrefsDto>;

export const DEFAULT_PREFS: NotifPrefs = {
  goalAchieved: true,
  goalDeadline: true,
  scheduledReminder: true,
  transferCreated: false,
};
