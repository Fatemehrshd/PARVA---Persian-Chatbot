import { IsString, IsOptional, IsEmail, MinLength, Matches, MaxLength } from 'class-validator';
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

  @IsString({ message: FA.passwordRequired })
  @MinLength(8, { message: FA.passwordMin })
  newPassword: string;
}
