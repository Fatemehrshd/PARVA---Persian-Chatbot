import { IsOptional, IsInt, Min, IsString, MinLength, IsIn, IsEmail, IsBoolean, ValidateIf } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt({ message: 'سقف توکن باید عدد صحیح باشد' })
  @Min(0, { message: 'سقف توکن نمی‌تواند منفی باشد' })
  globalTokenLimit?: number;

  @IsOptional()
  @IsString({ message: 'پرامپت سیستم باید رشته متنی باشد' })
  @MinLength(1, { message: 'پرامپت سیستم نمی‌تواند خالی باشد' })
  systemPrompt?: string;

  @IsOptional()
  @IsInt({ message: 'حداکثر حجم هر فایل باید عدد صحیح باشد' })
  @Min(1)
  fileMaxSizeMb?: number;

  @IsOptional()
  @IsInt({ message: 'حداکثر مجموع حجم فایل‌ها باید عدد صحیح باشد' })
  @Min(1)
  fileMaxTotalSizeMb?: number;

  @IsOptional()
  @IsInt({ message: 'حداکثر تعداد فایل باید عدد صحیح باشد' })
  @Min(1)
  fileMaxCount?: number;

  @IsOptional()
  @IsInt({ message: 'حداکثر سطرهای اکسل باید عدد صحیح باشد' })
  @Min(10)
  excelMaxRows?: number;

  @IsOptional()
  @IsInt({ message: 'تایم‌اوت پردازش باید عدد صحیح باشد' })
  @Min(10)
  fileProcessingTimeoutSec?: number;
}

export class UpdateUserAdminDto {
  @IsOptional()
  @IsIn(['user', 'admin'], { message: 'نقش کاربر فقط می‌تواند user یا admin باشد' })
  role?: string;

  @IsOptional()
  @IsString({ message: 'نام نمایشی باید رشته متنی باشد' })
  displayName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'ایمیل نامعتبر است' })
  email?: string;

  @IsOptional()
  @IsInt({ message: 'میزان توکن مصرفی باید عدد صحیح باشد' })
  @Min(0, { message: 'میزان توکن مصرفی نمی‌تواند منفی باشد' })
  usedTokens?: number;

  @IsOptional()
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsInt({ message: 'سقف توکن کاربر باید عدد صحیح باشد' })
  @Min(0, { message: 'سقف توکن کاربر نمی‌تواند منفی باشد' })
  tokenLimit?: number | null;
}

export class UpdateUserStatusDto {
  @IsBoolean({ message: 'وضعیت فعال بودن باید boolean باشد' })
  isActive: boolean;
}
