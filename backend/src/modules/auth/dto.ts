import { IsEmail, MinLength, IsOptional, IsString } from 'class-validator';
export class SignupDto { @IsEmail() email: string; @MinLength(8) password: string; @IsOptional() @IsString() displayName?: string; }
export class LoginDto { @IsEmail() email: string; @IsString() password: string; }
export class LogoutDto { @IsOptional() @IsString() refreshToken?: string; }
