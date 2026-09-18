import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModel } from './ai-model.entity';
import { AiProvider } from './ai-provider.entity';
import { maskSecret } from './mask-secret';
@Injectable()
export class ModelsAdminService {
  constructor(
    @InjectRepository(AiModel) private repo: Repository<AiModel>,
    @InjectRepository(AiProvider) private providers: Repository<AiProvider>,
  ) {}

  private maskApiKey(m: AiModel): AiModel {
    if (!m) return m;
    return { ...m, apiKey: maskSecret(m.apiKey) } as AiModel;
  }

  async list() {
    const models = await this.repo.find({ order: { createdAt: 'ASC' } });
    return models.map((m) => this.maskApiKey(m));
  }

  /**
   * Chat-ready listing: active models whose owning provider (when one is
   * linked/resolvable) is also active.
   */
  async listActive() {
    const models = await this.repo.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    const usable: AiModel[] = [];
    for (const m of models) {
      const provider = await this.resolveProvider(m);
      if (!provider || provider.isActive) usable.push(m);
    }
    return usable.map((m) => this.maskApiKey(m));
  }

  async getRawById(id: string): Promise<AiModel | null> {
    try {
      const byId = await this.repo.findOne({ where: { id } });
      if (byId) return byId;
    } catch (err: any) {
      if (err?.code !== '22P02') throw err;
    }
    try {
      return await this.repo.findOne({ where: { apiIdentifier: id } });
    } catch {
      return null;
    }
  }

  /** The provider row behind a model: by providerId first, legacy name second. */
  async resolveProvider(model: AiModel): Promise<AiProvider | null> {
    if (!model) return null;
    try {
      if (model.providerId) {
        const byId = await this.providers.findOne({ where: { id: model.providerId } });
        if (byId) return byId;
      }
      if (model.provider) {
        return await this.providers.findOne({ where: { name: model.provider } });
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
        p = await this.providers.findOne({ where: { id: providerId } });
      } catch (err: any) {
        if (err?.code !== '22P02') throw err;
      }
      if (!p) throw new BadRequestException('Provider not found');
      d.provider = p.name;
    } else if (d.provider) {
      // Backward compat: callers (and the existing admin UI) send a free-text
      // provider label — maintain the provider registry implicitly.
      let p = await this.providers.findOne({ where: { name: d.provider } }).catch(() => null);
      if (!p) {
        p = await this.providers.save(this.providers.create({ name: d.provider, isActive: true }));
      } else if (p.isActive === false) {
        throw new BadRequestException(`Provider "${p.name}" is disabled`);
      }
      providerId = p.id;
    }
    const m = await this.repo.save(this.repo.create({ isActive: true, ...d, providerId }));
    return this.maskApiKey(m);
  }

  async update(id: string, d: any) {
    let m;
    try {
      m = await this.repo.findOne({ where: { id } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!m) throw new NotFoundException('Resource not found');

    if (d.providerId !== undefined) {
      if (d.providerId) {
        let p;
        try {
          p = await this.providers.findOne({ where: { id: d.providerId } });
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

    const saved = await this.repo.save(m);
    return this.maskApiKey(saved);
  }

  async updateStatus(id: string, isActive: boolean) {
    let m;
    try {
      m = await this.repo.findOne({ where: { id } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!m) throw new NotFoundException('Resource not found');
    m.isActive = isActive;
    const saved = await this.repo.save(m);
    return this.maskApiKey(saved);
  }

  async remove(id: string) {
    let m;
    try {
      m = await this.repo.findOne({ where: { id } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!m) throw new NotFoundException('Resource not found');
    await this.repo.remove(m);
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
    return this.repo.findOne({ where: { isDefault: true } });
  }

  /**
   * User-facing platform default: the flagged model, but only when it is
   * actually usable (active itself, provider not disabled). Credentials stay
   * masked. Returns null when no usable default exists — callers fall back
   * to their list-based resolution.
   */
  async getUsableDefault(): Promise<AiModel | null> {
    const m = await this.getDefault();
    if (!m || m.isActive === false) return null;
    const provider = await this.resolveProvider(m);
    if (provider && provider.isActive === false) return null;
    return this.maskApiKey(m);
  }
}
