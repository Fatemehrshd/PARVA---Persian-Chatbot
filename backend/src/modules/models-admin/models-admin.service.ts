import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModel } from './ai-model.entity';
import { AiProvider } from './ai-provider.entity';
import { maskSecret } from './mask-secret';
import { OpenAiCompatForwarder } from '../ai/openai-compat.forwarder';
import { SettingsService, resolveModelAccess } from '../admin/settings.service';
@Injectable()
export class ModelsAdminService {
  constructor(
    @InjectRepository(AiModel) private repo: Repository<AiModel>,
    @InjectRepository(AiProvider) private providers: Repository<AiProvider>,
    @Optional() private forwarder?: OpenAiCompatForwarder,
    @Optional() private settings?: SettingsService,
  ) {}

  private maskApiKey(m: AiModel): AiModel {
    if (!m) return m;
    return { ...m, apiKey: maskSecret(m.apiKey) } as AiModel;
  }

  async list() {
    const models = await this.repo.find({ where: { isDeleted: false }, order: { createdAt: 'ASC' } });
    return models.map((m) => this.maskApiKey(m));
  }

  /**
   * Chat-ready listing: active models whose owning provider (when one is
   * linked/resolvable) is also active. When a `user` is supplied, models are
   * additionally filtered by that user's access rights (public/commercial/private).
   */
  async listActive(user?: { id?: string; role?: string } | null) {
    const models = await this.repo.find({
      where: { isActive: true, isDeleted: false },
      order: { createdAt: 'ASC' },
    });
    const access = this.settings ? await this.settings.getModelAccess().catch(() => ({})) : {};
    const usable: AiModel[] = [];
    for (const m of models) {
      const provider = await this.resolveProvider(m);
      if (provider && provider.isActive === false) continue;
      if (user && !resolveModelAccess(m, user, access)) continue;
      usable.push(m);
    }
    return usable.map((m) => this.maskApiKey(m));
  }

  /** Server-side check used by chat endpoints: may this user use this model? */
  async isModelAllowedForUser(
    model: AiModel | null,
    user: { id?: string; role?: string },
  ): Promise<boolean> {
    if (!model) return false;
    const access = this.settings ? await this.settings.getModelAccess().catch(() => ({})) : {};
    return resolveModelAccess(model, user, access);
  }

  async getRawById(id: string): Promise<AiModel | null> {
    try {
      const byId = await this.repo.findOne({ where: { id, isDeleted: false } });
      if (byId) return byId;
    } catch (err: any) {
      if (err?.code !== '22P02') throw err;
    }
    try {
      return await this.repo.findOne({ where: { apiIdentifier: id, isDeleted: false } });
    } catch {
      return null;
    }
  }

  /** The provider row behind a model: by providerId first, legacy name second. */
  async resolveProvider(model: AiModel): Promise<AiProvider | null> {
    if (!model) return null;
    try {
      if (model.providerId) {
        const byId = await this.providers.findOne({ where: { id: model.providerId, isDeleted: false } });
        if (byId) return byId;
      }
      if (model.provider) {
        return await this.providers.findOne({ where: { name: model.provider, isDeleted: false } });
      }
    } catch (err: any) {
      if (err?.code !== '22P02') throw err;
    }
    return null;
  }

  async create(d: Partial<AiModel>) {
    let providerId = d.providerId;
    if (providerId) {
      let p: AiProvider;
      try {
        p = await this.providers.findOne({ where: { id: providerId, isDeleted: false } });
      } catch (err: any) {
        if (err?.code !== '22P02') throw err;
      }
      if (!p) throw new BadRequestException('Provider not found');
      d.provider = p.name;
    } else if (d.provider) {
      // Backward compat: callers (and the existing admin UI) send a free-text
      // provider label — maintain the provider registry implicitly.
      let p = await this.providers.findOne({ where: { name: d.provider, isDeleted: false } }).catch(() => null);
      if (!p) {
        p = await this.providers.save(this.providers.create({ name: d.provider, isActive: true }));
      }
      providerId = p.id;
    }
    const m = await this.repo.save(this.repo.create({ isActive: true, ...d, providerId }));
    return this.maskApiKey(m);
  }

  async update(id: string, d: any) {
    let m;
    try {
      m = await this.repo.findOne({ where: { id, isDeleted: false } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!m) throw new NotFoundException('Resource not found');

    if (d.providerId !== undefined) {
      if (d.providerId) {
        let p;
        try {
          p = await this.providers.findOne({ where: { id: d.providerId, isDeleted: false } });
        } catch (err: any) {
          if (err?.code === '22P02') throw err;
        }
        if (!p) throw new BadRequestException('Provider not found');
        m.providerId = p.id;
        m.provider = p.name;
      } else {
        m.providerId = null as any;
      }
    } else if (d.provider !== undefined) {
      m.provider = d.provider;
    }

    if (d.name !== undefined) m.name = d.name;
    if (d.apiIdentifier !== undefined) m.apiIdentifier = d.apiIdentifier;
    if (d.apiKey !== undefined) m.apiKey = d.apiKey;
    if (d.baseUrl !== undefined) m.baseUrl = d.baseUrl;
    if (d.isActive !== undefined) m.isActive = d.isActive;
    if (d.accessLevel !== undefined) m.accessLevel = d.accessLevel;
    if (d.allowedUserIds !== undefined) m.allowedUserIds = Array.isArray(d.allowedUserIds) ? d.allowedUserIds : [];
    if (d.supportsThinking !== undefined) m.supportsThinking = d.supportsThinking;
    if (d.supportsVision !== undefined) m.supportsVision = d.supportsVision;
    if (d.supportsDocument !== undefined) m.supportsDocument = d.supportsDocument;
    if (d.thinkingBudgetTokens !== undefined) m.thinkingBudgetTokens = d.thinkingBudgetTokens;

    const saved = await this.repo.save(m);
    return this.maskApiKey(saved);
  }

  async updateStatus(id: string, isActive: boolean) {
    let m;
    try {
      m = await this.repo.findOne({ where: { id, isDeleted: false } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!m) throw new NotFoundException('Resource not found');

    const provider = await this.resolveProvider(m);
    const providerDefaultMismatch = provider && provider.defaultModelId === m.id && !isActive;

    if (m.isDefault && !isActive) {
      const otherDefault = await this.repo.findOne({ where: { isDefault: true, isDeleted: false } }).catch(() => null);
      if (!otherDefault || otherDefault.id === m.id) {
        throw new BadRequestException('برای غیرفعال کردن مدل پیش‌فرض، ابتدا یک مدل پیش‌فرض جدید انتخاب کنید');
      }
      m.isDefault = false;
    }

    if (providerDefaultMismatch) {
      const sameProviderModels = await this.repo.find({
        where: { providerId: provider.id, isActive: true, isDeleted: false },
        order: { createdAt: 'ASC' },
      });
      const replacement = sameProviderModels.find((candidate) => candidate.id !== m.id) ?? null;
      if (!replacement) {
        throw new BadRequestException(
          'برای غیرفعال کردن مدل پیش‌فرض ارائه‌دهنده، ابتدا یک مدل جایگزین برای همین ارائه‌دهنده انتخاب کنید',
        );
      }
      provider.defaultModelId = replacement.id;
      await this.providers.save(provider);
    }

    m.isActive = isActive;
    const saved = await this.repo.save(m);
    return this.maskApiKey(saved);
  }

  async remove(id: string) {
    let m;
    try {
      m = await this.repo.findOne({ where: { id, isDeleted: false } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!m) throw new NotFoundException('Resource not found');
    // Soft delete: keep the row for audit/history (conversations reference it).
    m.isDeleted = true;
    await this.repo.save(m);
    // A provider's default must never dangle at a deleted model — the admin
    // can then point it at another model via PATCH /admin/providers/:id/default.
    await this.providers.update({ defaultModelId: id }, { defaultModelId: null as any });
  }

  async setDefault(id: string) {
    let m;
    try {
      m = await this.repo.findOne({ where: { id } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!m) throw new NotFoundException('Resource not found');
    // NB: TypeORM rejects update() with empty criteria — and clearing only the
    // previously-default row(s) is cheaper anyway.
    await this.repo.update({ isDefault: true }, { isDefault: false });
    m.isDefault = true;
    const saved = await this.repo.save(m);
    return this.maskApiKey(saved);
  }

  async getDefault(): Promise<AiModel | null> {
    return this.repo.findOne({ where: { isDefault: true, isDeleted: false } });
  }

  /**
   * User-facing platform default: the flagged model, but only when it is
   * actually usable (active itself, provider not disabled). Returns null when
   * nothing usable is flagged — callers fall back to their list-based
   * resolution. When a user is supplied and the flagged default is not
   * accessible to them, the first allowed active model is returned instead.
   */
  async getUsableDefault(user?: { id?: string; role?: string } | null): Promise<AiModel | null> {
    const m = await this.getDefault();
    if (!m || m.isActive === false) return null;
    const provider = await this.resolveProvider(m);
    if (provider && provider.isActive === false) return null;
    if (user && !(await this.isModelAllowedForUser(m, user))) {
      const active = await this.listActive(user);
      return active.length ? active[0] : null;
    }
    return this.maskApiKey(m);
  }

  /**
   * Tests connectivity to an AI model by dispatching a lightweight prompt.
   * Can test an existing model (by modelId) or prospective model credentials.
   */
  async testModel(d: {
    modelId?: string;
    apiIdentifier?: string;
    providerId?: string;
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
  }): Promise<{ success: boolean; latencyMs: number; reply?: string; error?: string }> {
    let model: AiModel | null = null;
    if (d.modelId) {
      model = await this.getRawById(d.modelId);
    }

    let provider: AiProvider | null = null;
    const pId = d.providerId || model?.providerId;
    if (pId) {
      provider = await this.providers.findOne({ where: { id: pId, isDeleted: false } }).catch(() => null);
    } else {
      const pName = d.provider || model?.provider;
      if (pName) {
        provider = await this.providers.findOne({ where: { name: pName, isDeleted: false } }).catch(() => null);
      }
    }

    const tempModel = {
      apiIdentifier: d.apiIdentifier || model?.apiIdentifier || 'gpt-4o',
      apiKey: d.apiKey || model?.apiKey,
      baseUrl: d.baseUrl || model?.baseUrl,
    } as AiModel;

    const fwd = this.forwarder || new OpenAiCompatForwarder();
    const target = fwd.resolveTarget(tempModel, provider);
    if (!target || !target.apiKey) {
      return {
        success: false,
        latencyMs: 0,
        error: 'کلید API برای مدل یا ارائه‌دهنده تنظیم نشده است',
      };
    }

    return fwd.testTarget(target);
  }
}
