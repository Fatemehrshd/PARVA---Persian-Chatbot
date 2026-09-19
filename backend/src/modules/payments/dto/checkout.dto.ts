import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsString()
  @IsOptional()
  gateway?: string; // 'sandbox'

  @IsString()
  @IsOptional()
  callbackUrl?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsString()
  @IsOptional()
  couponCode?: string;
}
