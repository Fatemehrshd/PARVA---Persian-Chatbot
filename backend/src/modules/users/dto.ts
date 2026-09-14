import { IsString, IsOptional, IsEmail, MinLength, Matches, IsIn, MaxLength } from 'class-validator';
import { FA } from '../../shared/messages.fa';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: FA.displayNameString })
  @MaxLength(60, { message: 'نام نمایشی نباید بیشتر از ۶۰ کاراکتر باشد' })
  displayName?: string;

  @IsOptional()
  @Matches(/^[a-zA-Z0-9_]{3,30}$/, {
    message: 'نام کاربری نامعتبر است (۳ تا ۳۰ کاراکتر؛ فقط حروف انگلیسی، عدد و _)',
  })
  username?: string;

  @IsOptional()
  @IsString({ message: FA.string('بیو') })
  @MaxLength(500, { message: 'متن بیو نباید بیشتر از ۵۰۰ کاراکتر باشد' })
  bio?: string;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['fa', 'en'], { message: 'زبان فقط می‌تواند fa یا en باشد' })
  language?: string;

  @IsOptional()
  @IsIn(['light', 'dark'], { message: 'تم فقط می‌تواند light یا dark باشد' })
  theme?: string;

  @IsOptional()
  @IsString({ message: FA.string('منطقه زمانی') })
  @MaxLength(64, { message: 'منطقه زمانی نامعتبر است' })
  timezone?: string;

  @IsOptional()
  @IsString({ message: FA.string('مدل پیش‌فرض') })
  @MaxLength(64, { message: 'شناسه مدل پیش‌فرض نامعتبر است' })
  defaultModelId?: string;
}

export class ChangeEmailDto {
  @IsEmail({}, { message: FA.emailInvalid })
  email: string;

  @IsString({ message: FA.passwordRequired })
  password: string;
}

export class ChangePasswordDto {
  @IsString({ message: FA.passwordRequired })
  currentPassword: string;

  @IsString({ message: FA.passwordMin })
  @MinLength(8, { message: FA.passwordMin })
  newPassword: string;
}
