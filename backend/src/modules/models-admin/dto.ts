import { IsString, IsOptional, IsBoolean, IsUUID, IsIn, IsArray, IsInt, Min } from 'class-validator';
import { FA } from '../../shared/messages.fa';

export class CreateModelDto {
  @IsString({ message: FA.nameRequired })
  name: string;

  @IsString({ message: FA.providerRequired })
  provider: string;

  @IsString({ message: FA.apiIdentifierRequired })
  apiIdentifier: string;

  @IsOptional()
  @IsUUID('4', { message: FA.uuid('providerId') })
  providerId?: string;

  @IsOptional()
  @IsString({ message: FA.string('apiKey') })
  apiKey?: string;

  @IsOptional()
  @IsString({ message: FA.string('baseUrl') })
  baseUrl?: string;

  @IsOptional()
  @IsBoolean({ message: FA.boolean('isActive') })
  isActive?: boolean;

  @IsOptional()
  @IsIn(['public', 'commercial', 'private'], { message: 'سطح دسترسی باید public، commercial یا private باشد' })
  accessLevel?: 'public' | 'commercial' | 'private';

  @IsOptional()
  @IsArray({ message: 'لیست کاربران مجاز باید آرایه باشد' })
  @IsUUID('4', { each: true, message: FA.uuid('allowedUserIds') })
  allowedUserIds?: string[];

  @IsOptional()
  @IsBoolean({ message: FA.boolean('supportsThinking') })
  supportsThinking?: boolean;

  @IsOptional()
  @IsBoolean({ message: FA.boolean('supportsVision') })
  supportsVision?: boolean;

  @IsOptional()
  @IsBoolean({ message: FA.boolean('supportsDocument') })
  supportsDocument?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  thinkingBudgetTokens?: number | null;
}

export class UpdateModelStatusDto {
  @IsBoolean({ message: FA.boolean('isActive') })
  isActive: boolean;
}

export class UpdateModelDto {
  @IsOptional()
  @IsString({ message: FA.string('name') })
  name?: string;

  @IsOptional()
  @IsString({ message: FA.string('provider') })
  provider?: string;

  @IsOptional()
  @IsUUID('4', { message: FA.uuid('providerId') })
  providerId?: string;

  @IsOptional()
  @IsString({ message: FA.string('apiIdentifier') })
  apiIdentifier?: string;

  @IsOptional()
  @IsString({ message: FA.string('apiKey') })
  apiKey?: string;

  @IsOptional()
  @IsString({ message: FA.string('baseUrl') })
  baseUrl?: string;

  @IsOptional()
  @IsBoolean({ message: FA.boolean('isActive') })
  isActive?: boolean;

  @IsOptional()
  @IsIn(['public', 'commercial', 'private'], { message: 'سطح دسترسی باید public، commercial یا private باشد' })
  accessLevel?: 'public' | 'commercial' | 'private';

  @IsOptional()
  @IsArray({ message: 'لیست کاربران مجاز باید آرایه باشد' })
  @IsUUID('4', { each: true, message: FA.uuid('allowedUserIds') })
  allowedUserIds?: string[];

  @IsOptional()
  @IsBoolean({ message: FA.boolean('supportsThinking') })
  supportsThinking?: boolean;

  @IsOptional()
  @IsBoolean({ message: FA.boolean('supportsVision') })
  supportsVision?: boolean;

  @IsOptional()
  @IsBoolean({ message: FA.boolean('supportsDocument') })
  supportsDocument?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  thinkingBudgetTokens?: number | null;
}

