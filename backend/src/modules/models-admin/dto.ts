import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';
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
}

export class UpdateModelStatusDto {
  @IsBoolean({ message: FA.boolean('isActive') })
  isActive: boolean;
}
