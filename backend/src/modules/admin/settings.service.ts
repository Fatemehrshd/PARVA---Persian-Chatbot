import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './system-setting.entity';
import { UpdateSettingsDto } from './dto';

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful and knowledgeable AI assistant.';
export const DEFAULT_GLOBAL_TOKEN_LIMIT = 0; // 0 = unlimited
/** نرخ پیش‌فرض هر ۱۰۰۰ توکن به دلار */
export const DEFAULT_TOKEN_RATE_PER_1000 = 10; // $10 per 1000 tokens

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private repo: Repository<SystemSetting>,
  ) {}

  async get(key: string, defaultValue = ''): Promise<string> {
    try {
      const row = await this.repo.findOne({ where: { key } });
      if (row && row.value !== undefined && row.value !== null) {
        return row.value;
      }
    } catch {
      // Return default if table not initialized or during unit test fakes
    }
    return defaultValue;
  }

  async set(key: string, value: string): Promise<void> {
    let row = await this.repo.findOne({ where: { key } }).catch(() => null);
    if (!row) {
      row = this.repo.create({ key, value });
    } else {
      row.value = value;
    }
    await this.repo.save(row);
  }

  async getGlobalTokenLimit(): Promise<number> {
    const val = await this.get('global_token_limit', String(DEFAULT_GLOBAL_TOKEN_LIMIT));
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? DEFAULT_GLOBAL_TOKEN_LIMIT : parsed;
  }

  /** دریافت نرخ هر ۱۰۰۰ توکن به دلار */
  async getTokenRatePer1000(): Promise<number> {
    const val = await this.get('token_rate_per_1000', String(DEFAULT_TOKEN_RATE_PER_1000));
    const parsed = parseFloat(val);
    return isNaN(parsed) || parsed <= 0 ? DEFAULT_TOKEN_RATE_PER_1000 : parsed;
  }

  async getSystemPrompt(): Promise<string> {
    return this.get('system_prompt', DEFAULT_SYSTEM_PROMPT);
  }

  async getAll(): Promise<{
    globalTokenLimit: number;
    tokenRatePer1000: number;
    systemPrompt: string;
    fileMaxSizeMb: number;
    fileMaxTotalSizeMb: number;
    fileMaxCount: number;
    excelMaxRows: number;
    fileProcessingTimeoutSec: number;
  }> {
    const [
      globalTokenLimit,
      tokenRatePer1000,
      systemPrompt,
      fileMaxSizeMb,
      fileMaxTotalSizeMb,
      fileMaxCount,
      excelMaxRows,
      fileProcessingTimeoutSec,
    ] = await Promise.all([
      this.getGlobalTokenLimit(),
      this.getTokenRatePer1000(),
      this.getSystemPrompt(),
      this.get('file_max_size_mb', '20').then(Number),
      this.get('file_max_total_size_mb', '50').then(Number),
      this.get('file_max_count', '5').then(Number),
      this.get('excel_max_rows', '5000').then(Number),
      this.get('file_processing_timeout_sec', '120').then(Number),
    ]);

    return {
      globalTokenLimit,
      tokenRatePer1000,
      systemPrompt,
      fileMaxSizeMb: isNaN(fileMaxSizeMb) ? 20 : fileMaxSizeMb,
      fileMaxTotalSizeMb: isNaN(fileMaxTotalSizeMb) ? 50 : fileMaxTotalSizeMb,
      fileMaxCount: isNaN(fileMaxCount) ? 5 : fileMaxCount,
      excelMaxRows: isNaN(excelMaxRows) ? 5000 : excelMaxRows,
      fileProcessingTimeoutSec: isNaN(fileProcessingTimeoutSec) ? 120 : fileProcessingTimeoutSec,
    };
  }

  async update(dto: UpdateSettingsDto): Promise<any> {
    if (dto.globalTokenLimit !== undefined) {
      await this.set('global_token_limit', String(dto.globalTokenLimit));
    }
    if (dto.tokenRatePer1000 !== undefined) {
      await this.set('token_rate_per_1000', String(dto.tokenRatePer1000));
    }
    if (dto.systemPrompt !== undefined) {
      await this.set('system_prompt', dto.systemPrompt);
    }
    if (dto.fileMaxSizeMb !== undefined) {
      await this.set('file_max_size_mb', String(dto.fileMaxSizeMb));
    }
    if (dto.fileMaxTotalSizeMb !== undefined) {
      await this.set('file_max_total_size_mb', String(dto.fileMaxTotalSizeMb));
    }
    if (dto.fileMaxCount !== undefined) {
      await this.set('file_max_count', String(dto.fileMaxCount));
    }
    if (dto.excelMaxRows !== undefined) {
      await this.set('excel_max_rows', String(dto.excelMaxRows));
    }
    if (dto.fileProcessingTimeoutSec !== undefined) {
      await this.set('file_processing_timeout_sec', String(dto.fileProcessingTimeoutSec));
    }
    return this.getAll();
  }
}
