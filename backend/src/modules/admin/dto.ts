import { IsOptional, IsInt, Min, IsString, MinLength, IsIn, IsEmail } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt({ message: 'سقف توکن باید عدد صحیح باشد' })
  @Min(0, { message: 'سقف توکن نمی‌تواند منفی باشد' })
  globalTokenLimit?: number;

  @IsOptional()
  @IsString({ message: 'پرامپت سیستم باید رشته متنی باشد' })
  @MinLength(1, { message: 'پرامپت سیستم نمی‌تواند خالی باشد' })
  systemPrompt?: string;
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
}
