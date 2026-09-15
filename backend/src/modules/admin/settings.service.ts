import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './system-setting.entity';
import { UpdateSettingsDto } from './dto';

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful and knowledgeable AI assistant.';
export const DEFAULT_GLOBAL_TOKEN_LIMIT = 0; // 0 = unlimited

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private repo: Repository<SystemSetting>,
  ) {}

  private async getSetting(key: string, defaultValue: string): Promise<string> {
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

  private async setSetting(key: string, value: string): Promise<void> {
    let row = await this.repo.findOne({ where: { key } }).catch(() => null);
    if (!row) {
      row = this.repo.create({ key, value });
    } else {
      row.value = value;
    }
    await this.repo.save(row);
  }

  async getGlobalTokenLimit(): Promise<number> {
    const val = await this.getSetting('global_token_limit', String(DEFAULT_GLOBAL_TOKEN_LIMIT));
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? DEFAULT_GLOBAL_TOKEN_LIMIT : parsed;
  }

  async getSystemPrompt(): Promise<string> {
    return this.getSetting('system_prompt', DEFAULT_SYSTEM_PROMPT);
  }

  async getAll(): Promise<{ globalTokenLimit: number; systemPrompt: string }> {
    const [globalTokenLimit, systemPrompt] = await Promise.all([
      this.getGlobalTokenLimit(),
      this.getSystemPrompt(),
    ]);
    return { globalTokenLimit, systemPrompt };
  }

  async update(dto: UpdateSettingsDto): Promise<{ globalTokenLimit: number; systemPrompt: string }> {
    if (dto.globalTokenLimit !== undefined) {
      await this.setSetting('global_token_limit', String(dto.globalTokenLimit));
    }
    if (dto.systemPrompt !== undefined) {
      await this.setSetting('system_prompt', dto.systemPrompt);
    }
    return this.getAll();
  }
}
