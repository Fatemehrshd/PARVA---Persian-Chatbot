import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  authority: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsObject()
  @IsOptional()
  payload?: any;
}
