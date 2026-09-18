import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './system-setting.entity';
import { UpdateSettingsDto } from './dto';

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful and knowledgeable AI assistant.';
export const DEFAULT_GLOBAL_TOKEN_LIMIT = 0; // 0 = unlimited
/** نرخ پیش‌فرض هر ۱۰۰۰ توکن به دلار */
export const DEFAULT_TOKEN_RATE_PER_1000 = 10; // $10 per 1000 tokens
export const WEB_SEARCH_ENABLED_KEY = 'web_search_enabled';
export const WEB_SEARCH_USED_KEY = 'web_search_used_credits';
export const WEB_SEARCH_QUOTA_KEY = 'web_search_quota_total';
export const DEFAULT_WEB_SEARCH_QUOTA = 2500; // Serper free trial credits
export const ROLE_TOKEN_LIMITS_KEY = 'role_token_limits';
export const TASK_MULTIPLIERS_KEY = 'task_multipliers';
export const ROLE_QUOTAS_KEY = 'role_quotas';
export const TASK_TYPES = ['image', 'document', 'thinking'] as const;
export const DEFAULT_RESET_HOURS = 6;
export type RoleQuota = {
  tokenLimit: number | null;
  messageLimit: number | null;
  resetHours: number | null;
};

/**
 * سقف مؤثر توکن یک کاربر با همان اولویت اعمال در ChatService:
 * سقف اختصاصی کاربر ← سقف نقش ← سقف سراسری. مقدار 0 هر لایه یعنی
 * «نامحدود» و لایه‌های بعدی را نادیده می‌گیرد. null = نامحدود.
 */
export function resolveEffectiveTokenLimit(
  user: { tokenLimit?: number | null; role?: string },
  roleLimits: Record<string, number>,
  globalLimit: number,
): number | null {
  if (user.tokenLimit !== null && user.tokenLimit !== undefined) {
    return user.tokenLimit > 0 ? user.tokenLimit : null;
  }
  const roleLimit = user.role ? roleLimits[user.role] : undefined;
  if (roleLimit !== undefined && roleLimit !== null) {
    return roleLimit > 0 ? roleLimit : null;
  }
  return globalLimit > 0 ? globalLimit : null;
}

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

  async getWebSearchEnabled(): Promise<boolean> {
    const v = await this.get(WEB_SEARCH_ENABLED_KEY, 'true');
    return v !== 'false';
  }

  async getWebSearchUsage(): Promise<{ used: number; total: number; remaining: number }> {
    const usedRaw = await this.get(WEB_SEARCH_USED_KEY, '0');
    const totalRaw = await this.get(WEB_SEARCH_QUOTA_KEY, String(DEFAULT_WEB_SEARCH_QUOTA));
    const usedParsed = parseInt(usedRaw, 10);
    const totalParsed = parseInt(totalRaw, 10);
    const used = isNaN(usedParsed) || usedParsed < 0 ? 0 : usedParsed;
    const total = isNaN(totalParsed) || totalParsed < 0 ? DEFAULT_WEB_SEARCH_QUOTA : totalParsed;
    return { used, total, remaining: Math.max(0, total - used) };
  }

  /**
   * سقف توکن به ازای هر نقش (مثلاً user/admin و نقش‌های آینده). فقط مقادیر
   * صحیح غیرمنفی نگه داشته می‌شوند؛ ورودی خراب نادیده گرفته می‌شود تا هرگز
   * جلوی چت را نگیرد. نقشِ غایب یعنی سقف سراسری برایش اعمال شود.
   */
  async getRoleTokenLimits(): Promise<Record<string, number>> {
    const raw = await this.get(ROLE_TOKEN_LIMITS_KEY, '{}');
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const clean: Record<string, number> = {};
      for (const [role, val] of Object.entries(parsed)) {
        if (typeof role !== 'string' || !/^[a-z0-9_-]{1,32}$/i.test(role)) continue;
        const num = typeof val === 'number' ? val : parseInt(String(val), 10);
        if (Number.isFinite(num) && num >= 0) clean[role] = Math.floor(num);
      }
      return clean;
    } catch {
      return {};
    }
  }

  /** ثبت/به‌روزرسانی سقف یک نقش به صورت منفرد؛ null یعنی حذف سقف آن نقش. */
  async setRoleTokenLimit(role: string, limit: number | null): Promise<Record<string, number>> {
    const current = await this.getRoleTokenLimits();
    if (limit === null || limit === undefined) {
      delete current[role];
    } else {
      const num = Math.floor(Number(limit));
      if (!Number.isFinite(num) || num < 0) {
        delete current[role];
      } else {
        current[role] = num;
      }
    }
    await this.set(ROLE_TOKEN_LIMITS_KEY, JSON.stringify(current));
    return current;
  }

  async getTaskMultipliers(): Promise<Record<string, number>> {
    const raw = await this.get(TASK_MULTIPLIERS_KEY, '{}');
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const clean: Record<string, number> = {};
      for (const type of TASK_TYPES) {
        const value = Number(parsed[type]);
        if (Number.isFinite(value) && value > 0) clean[type] = value;
      }
      return clean;
    } catch {
      return {};
    }
  }

  async setTaskMultiplier(type: string, value: number | null): Promise<void> {
    if (!(TASK_TYPES as readonly string[]).includes(type)) return;
    const current = await this.getTaskMultipliers();
    const numeric = Number(value);
    if (value === null || !Number.isFinite(numeric) || numeric <= 0) delete current[type];
    else current[type] = numeric;
    await this.set(TASK_MULTIPLIERS_KEY, JSON.stringify(current));
  }

  async getRoleQuotas(): Promise<Record<string, RoleQuota>> {
    const raw = await this.get(ROLE_QUOTAS_KEY, '');
    if (!raw) {
      const legacy = await this.getRoleTokenLimits();
      const seeded: Record<string, RoleQuota> = {};
      for (const [role, tokenLimit] of Object.entries(legacy)) {
        seeded[role] = { tokenLimit, messageLimit: null, resetHours: null };
      }
      if (Object.keys(seeded).length > 0) await this.set(ROLE_QUOTAS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const normalize = (value: unknown): number | null => {
        if (value === null || value === undefined || value === '') return null;
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : null;
      };
      const clean: Record<string, RoleQuota> = {};
      for (const [role, quota] of Object.entries(parsed as Record<string, any>)) {
        if (!quota || typeof quota !== 'object') continue;
        clean[role] = {
          tokenLimit: normalize(quota.tokenLimit),
          messageLimit: normalize(quota.messageLimit),
          resetHours: normalize(quota.resetHours),
        };
      }
      return clean;
    } catch {
      return {};
    }
  }

  async setRoleQuota(role: string, quota: RoleQuota | null): Promise<Record<string, RoleQuota>> {
    const current = await this.getRoleQuotas();
    if (quota === null) delete current[role];
    else current[role] = quota;
    await this.set(ROLE_QUOTAS_KEY, JSON.stringify(current));
    return current;
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
    webSearchEnabled: boolean;
    webSearchUsage: { used: number; total: number; remaining: number };
    roleTokenLimits: Record<string, number>;
    taskMultipliers: Record<string, number>;
    roleQuotas: Record<string, RoleQuota>;
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
      roleTokenLimits,
      taskMultipliers,
      roleQuotas,
    ] = await Promise.all([
      this.getGlobalTokenLimit(),
      this.getTokenRatePer1000(),
      this.getSystemPrompt(),
      this.get('file_max_size_mb', '20').then(Number),
      this.get('file_max_total_size_mb', '50').then(Number),
      this.get('file_max_count', '5').then(Number),
      this.get('excel_max_rows', '5000').then(Number),
      this.get('file_processing_timeout_sec', '120').then(Number),
      this.getRoleTokenLimits(),
      this.getTaskMultipliers(),
      this.getRoleQuotas(),
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
      webSearchEnabled: await this.getWebSearchEnabled(),
      webSearchUsage: await this.getWebSearchUsage(),
      roleTokenLimits,
      taskMultipliers,
      roleQuotas,
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
    if (dto.webSearchEnabled !== undefined) {
      await this.set(WEB_SEARCH_ENABLED_KEY, dto.webSearchEnabled ? 'true' : 'false');
    }
    if (dto.webSearchQuotaTotal !== undefined) {
      await this.set(WEB_SEARCH_QUOTA_KEY, String(dto.webSearchQuotaTotal));
    }
    if (dto.webSearchUsedCredits !== undefined) {
      await this.set(WEB_SEARCH_USED_KEY, String(dto.webSearchUsedCredits));
    }
    // سقف نقش‌ها به صورت merge اعمال می‌شود تا ویرایش یک نقش بقیه را پاک نکند.
    if (dto.roleTokenLimits !== undefined && dto.roleTokenLimits !== null) {
      for (const [role, limit] of Object.entries(dto.roleTokenLimits)) {
        await this.setRoleTokenLimit(role, limit);
      }
    }
    if (dto.taskMultipliers !== undefined && dto.taskMultipliers !== null) {
      for (const [type, value] of Object.entries(dto.taskMultipliers)) {
        await this.setTaskMultiplier(type, value);
      }
    }
    if (dto.roleQuotas !== undefined && dto.roleQuotas !== null) {
      for (const [role, quota] of Object.entries(dto.roleQuotas)) {
        await this.setRoleQuota(role, quota);
      }
    }
    return this.getAll();
  }
}
