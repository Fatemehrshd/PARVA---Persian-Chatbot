import { IsString, IsOptional, MinLength, IsUUID, IsArray } from 'class-validator';
import { FA } from '../../shared/messages.fa';

export class CreateConvDto {
  @IsOptional()
  @IsUUID('4', { message: FA.modelIdUuid })
  modelId?: string;

  @IsOptional()
  @IsString({ message: FA.titleString })
  title?: string;
}

export class UpdateConvDto {
  @IsOptional()
  @IsString({ message: FA.titleString })
  @MinLength(1, { message: FA.contentMin })
  title?: string;

  @IsOptional()
  @IsUUID('4', { message: FA.modelIdUuid })
  modelId?: string;
}

export class SendMsgDto {
  @IsString({ message: FA.contentString })
  @MinLength(1, { message: FA.contentMin })
  content: string;

  @IsOptional()
  @IsArray()
  fileIds?: string[];
}
