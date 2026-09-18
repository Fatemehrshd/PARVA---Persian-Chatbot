import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../admin/system-setting.entity';
import { WEB_SEARCH_USED_KEY } from '../admin/settings.service';

export interface WebSource {
  title: string;
  url: string;
  snippet?: string;
}

const SEARCH_TIMEOUT_MS = 10000;
const MAX_SOURCES = 8;

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);
  constructor(
    @Optional()
    @InjectRepository(SystemSetting)
    private readonly settingsRepo?: Repository<SystemSetting>,
  ) {}

  /**
   * `fetcher` is an explicit ambient capability (global fetch), NOT a Nest
   * provider — keeping it out of the constructor avoids a DI resolution
   * failure ("can't resolve dependencies of WebSearchService"). Tests pass a
   * fake per call; production uses the default global fetch.
   */
  async search(query: string, fetcher: typeof fetch = fetch): Promise<WebSource[]> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error('کلید جستجوی وب تنظیم نشده است (SERPER_API_KEY)');
    const q = (query || '').trim().slice(0, 300);
    if (!q) return [];
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
    try {
      const res = await fetcher('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
        body: JSON.stringify({ q, num: MAX_SOURCES }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`خطا در سرویس جستجوی وب (${res.status})`);
      const data: any = await res.json();
      // Serper bills 1 credit per successful search — count it. Counting must
      // NEVER break searching, so any failure here is only warned about.
      await this.countUsage().catch((err) =>
        this.logger.warn(`Web-search usage counter failed: ${err instanceof Error ? err.message : String(err)}`),
      );
      const organic: any[] = Array.isArray(data?.organic) ? data.organic : [];
      return organic.slice(0, MAX_SOURCES).flatMap((r) => {
        const url = String(r?.link ?? r?.url ?? '');
        if (!/^https:\/\//i.test(url)) return [];
        return [{ title: String(r?.title ?? url), url, snippet: String(r?.snippet ?? '') }];
      });
    } finally {
      clearTimeout(timer);
    }
  }

  /** Atomically increments the used-credits counter (race-safe under concurrency). */
  private async countUsage(): Promise<void> {
    if (!this.settingsRepo) return;
    await this.settingsRepo.query(
      `INSERT INTO system_settings ("key", "value") VALUES ($1, '1')
       ON CONFLICT ("key") DO UPDATE
       SET "value" = (COALESCE(NULLIF(system_settings."value", ''), '0')::int + 1)::text`,
      [WEB_SEARCH_USED_KEY],
    );
  }
}
