import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { FA } from '../../shared/messages.fa';

export class SignupDto {
  @IsEmail({}, { message: FA.emailInvalid })
  email: string;

  @IsString({ message: FA.passwordRequired })
  @MinLength(8, { message: FA.passwordMin })
  password: string;

  @IsOptional()
  @IsString({ message: FA.displayNameString })
  displayName?: string;
}

export class LoginDto {
  @IsEmail({}, { message: FA.emailInvalid })
  email: string;

  @IsString({ message: FA.passwordRequired })
  password: string;
}

export class LogoutDto {
  // Body is preserved for forward-compat but logout is identified by the bearer token,
  // so this field is intentionally unvalidated beyond being a string when present.
  @IsOptional()
  @IsString({ message: FA.string('refreshToken') })
  refreshToken?: string;
}
