import { IsString, IsOptional, MinLength, IsUUID, IsArray, ValidateIf, IsBoolean } from 'class-validator';
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

  @IsOptional()
  @IsBoolean({ message: 'وضعیت پین باید boolean باشد' })
  isPinned?: boolean;
}

export class SendMsgDto {
  @ValidateIf((o) => !o.fileIds || o.fileIds.length === 0)
  @IsString({ message: FA.contentString })
  @MinLength(1, { message: FA.contentMin })
  content?: string;

  @IsOptional()
  @IsArray()
  fileIds?: string[];

  @IsOptional()
  @IsBoolean({ message: 'گزینه جستجوی وب باید boolean باشد' })
  useWebSearch?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'گزینه تفکر عمیق باید boolean باشد' })
  useThinking?: boolean;
}
