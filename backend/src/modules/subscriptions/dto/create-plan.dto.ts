import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  Min,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  durationDays?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tokenQuota?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  messageQuota?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  resetHours?: number;

  @IsObject()
  @IsOptional()
  features?: {
    webSearch?: boolean;
    thinking?: boolean;
    document?: boolean;
    maxFileSizeMb?: number;
    [key: string]: any;
  };

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  modelIds?: string[];
}
