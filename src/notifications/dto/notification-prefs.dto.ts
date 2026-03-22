import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @IsBoolean()
  @IsOptional()
  goalAchieved?: boolean;

  @IsBoolean()
  @IsOptional()
  goalDeadline?: boolean;

  @IsBoolean()
  @IsOptional()
  scheduledReminder?: boolean;

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
