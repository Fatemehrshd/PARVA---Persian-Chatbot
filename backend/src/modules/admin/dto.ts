import { IsOptional, IsInt, Min, IsString, MinLength, IsIn, IsEmail, IsBoolean, ValidateIf, IsObject, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeNumericValue } from '../../shared/number-input';

const normalizeNumber = () => Transform(({ value }) => normalizeNumericValue(value));

export class UpdateSettingsDto {
  @IsOptional()
  @normalizeNumber()
  @IsInt({ message: 'سقف توکن باید عدد صحیح باشد' })
  @Min(0, { message: 'سقف توکن نمی‌تواند منفی باشد' })
  globalTokenLimit?: number;

  /** نرخ دلار به ازای هر ۱۰۰۰ توکن (پیش‌فرض: ۱۰ دلار) */
  @IsOptional()
  @normalizeNumber()
  @Min(0.01, { message: 'نرخ تبدیل توکن به دلار باید مثبت باشد' })
  tokenRatePer1000?: number;

  @IsOptional()
  @IsString({ message: 'پرامپت سیستم باید رشته متنی باشد' })
  @MinLength(1, { message: 'پرامپت سیستم نمی‌تواند خالی باشد' })
  systemPrompt?: string;

  @IsOptional()
  @normalizeNumber()
  @IsInt({ message: 'حداکثر حجم هر فایل باید عدد صحیح باشد' })
  @Min(1)
  fileMaxSizeMb?: number;

  @IsOptional()
  @normalizeNumber()
  @IsInt({ message: 'حداکثر مجموع حجم فایل‌ها باید عدد صحیح باشد' })
  @Min(1)
  fileMaxTotalSizeMb?: number;

  @IsOptional()
  @normalizeNumber()
  @IsInt({ message: 'حداکثر تعداد فایل باید عدد صحیح باشد' })
  @Min(1)
  fileMaxCount?: number;

  @IsOptional()
  @normalizeNumber()
  @IsInt({ message: 'حداکثر سطرهای اکسل باید عدد صحیح باشد' })
  @Min(10)
  excelMaxRows?: number;

  @IsOptional()
  @normalizeNumber()
  @IsInt({ message: 'تایم‌اوت پردازش باید عدد صحیح باشد' })
  @Min(10)
  fileProcessingTimeoutSec?: number;

  @IsOptional()
  @IsBoolean({ message: 'وضعیت جستجوی وب باید boolean باشد' })
  webSearchEnabled?: boolean;

  @IsOptional()
  @normalizeNumber()
  @IsInt({ message: 'سقف اعتبار جستجو باید عدد صحیح باشد' })
  @Min(1, { message: 'سقف اعتبار جستجو باید حداقل ۱ باشد' })
  webSearchQuotaTotal?: number;

  @IsOptional()
  @normalizeNumber()
  @IsInt({ message: 'مصرف اعتبار جستجو باید عدد صحیح باشد' })
  @Min(0, { message: 'مصرف اعتبار جستجو نمی‌تواند منفی باشد' })
  webSearchUsedCredits?: number;

  /**
   * سقف توکن به ازای نقش (نقش → سقف). هر مقدار صحیح غیرمنفی است؛
   * null یعنی حذف سقف آن نقش (سقف سراسری اعمال می‌شود).
   */
  @IsOptional()
  @IsObject({ message: 'سقف نقش‌ها باید یک شیء معتبر باشد' })
  roleTokenLimits?: Record<string, number | null>;

  @IsOptional()
  @IsObject({ message: 'ضرایب نوع کار باید شیء معتبر باشد' })
  taskMultipliers?: Record<string, number | null>;

  @IsOptional()
  @IsObject({ message: 'سهمیه نقش‌ها باید شیء معتبر باشد' })
  roleQuotas?: Record<string, { tokenLimit: number | null; messageLimit: number | null; resetHours: number | null } | null>;

  /** نقش → سطوح دسترسی مدل مجاز (['public','commercial','private'])؛ null = بازگشت به پیش‌فرض. */
  @IsOptional()
  @IsObject({ message: 'دسترسی مدل نقش‌ها باید شیء معتبر باشد' })
  modelAccess?: Record<string, string[] | null>;

  @IsOptional()
  @IsNumber({}, { message: 'ضریب توکن جستجوی وب باید عدد باشد' })
  @Min(1, { message: 'ضریب توکن جستجوی وب باید حداقل ۱ باشد' })
  webSearchMultiplier?: number;

  @IsOptional()
  @IsNumber({}, { message: 'ضریب توکن تفکر عمیق باید عدد باشد' })
  @Min(1, { message: 'ضریب توکن تفکر عمیق باید حداقل ۱ باشد' })
  thinkingMultiplier?: number;
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
  @normalizeNumber()
  @IsInt({ message: 'میزان توکن مصرفی باید عدد صحیح باشد' })
  @Min(0, { message: 'میزان توکن مصرفی نمی‌تواند منفی باشد' })
  usedTokens?: number;

  @IsOptional()
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @normalizeNumber()
  @IsInt({ message: 'سقف توکن کاربر باید عدد صحیح باشد' })
  @Min(0, { message: 'سقف توکن کاربر نمی‌تواند منفی باشد' })
  tokenLimit?: number | null;

  @IsOptional()
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @normalizeNumber()
  @IsInt({ message: 'سقف تعداد پیام باید عدد صحیح باشد' })
  @Min(0, { message: 'سقف تعداد پیام نمی‌تواند منفی باشد' })
  messageLimit?: number | null;
}

export class UpdateUserStatusDto {
  @IsBoolean({ message: 'وضعیت فعال بودن باید boolean باشد' })
  isActive: boolean;
}
