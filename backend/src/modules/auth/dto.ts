import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { FA } from '../../shared/messages.fa';

export class SignupDto {
  @IsEmail({}, { message: FA.emailInvalid })
  email: string;

  @IsString({ message: FA.passwordRequired })
  @MinLength(8, { message: FA.passwordMin })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]).{8,}$/, {
    message: FA.passwordComplexity,
  })
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

export class RefreshTokenDto {
  @IsString({ message: FA.refreshTokenRequired })
  refreshToken: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString({ message: FA.string('refreshToken') })
  refreshToken?: string;
}
