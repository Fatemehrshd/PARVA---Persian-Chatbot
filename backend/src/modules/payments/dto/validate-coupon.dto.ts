import { IsString, IsNotEmpty } from 'class-validator';

export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'کد تخفیف الزامی است.' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'شناسه پلن الزامی است.' })
  planId: string;
}
