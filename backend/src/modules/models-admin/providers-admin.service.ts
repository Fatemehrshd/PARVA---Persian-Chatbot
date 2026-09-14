import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AiProvider } from './ai-provider.entity';
import { AiModel } from './ai-model.entity';
import { maskSecret } from './mask-secret';

@Injectable()
export class ProvidersAdminService {
  constructor(
    @InjectRepository(AiProvider) private repo: Repository<AiProvider>,
    @InjectRepository(AiModel) private models: Repository<AiModel>,
  ) {}

  private mask(p: AiProvider): AiProvider {
    if (!p) return p;
    return { ...p, apiKey: maskSecret(p.apiKey) } as AiProvider;
  }

  private async byId(id: string): Promise<AiProvider> {
    let p: AiProvider;
    try {
      p = await this.repo.findOne({ where: { id } });
    } catch (err: any) {
      if (err?.code === '22P02') throw new NotFoundException('Resource not found');
      throw err;
    }
    if (!p) throw new NotFoundException('Resource not found');
    return p;
  }

  findByName(name: string): Promise<AiProvider | null> {
    return this.repo.findOne({ where: { name } }).catch(() => null);
  }

  /** Creates the provider if missing, returns the (existing or new) row. */
  async ensureByName(name: string): Promise<AiProvider> {
    const existing = await this.findByName(name);
    if (existing) return existing;
    return this.repo.save(this.repo.create({ name, isActive: true }));
  }

  async list() {
    const all = await this.repo.find({ order: { createdAt: 'ASC' } });
    return all.map((p) => this.mask(p));
  }

  async create(d: { name: string; baseUrl?: string; apiKey?: string; isActive?: boolean }) {
    const dup = await this.repo.findOne({ where: { name: d.name } }).catch(() => null);
    if (dup) throw new ConflictException(`Provider "${d.name}" already exists`);
    const p = await this.repo.save(
      this.repo.create({ isActive: true, baseUrl: undefined, apiKey: undefined, ...d }),
    );
    return this.mask(p);
  }

  /** Update metadata; an empty/absent apiKey means "leave the stored key untouched". */
  async update(
    id: string,
    d: { name?: string; baseUrl?: string; apiKey?: string; isActive?: boolean },
  ) {
    const p = await this.byId(id);
    if (d.name !== undefined && d.name !== p.name) {
      const dup = await this.repo.findOne({ where: { name: d.name } }).catch(() => null);
      if (dup) throw new ConflictException(`Provider "${d.name}" already exists`);
      p.name = d.name;
    }
    if (d.baseUrl !== undefined) p.baseUrl = d.baseUrl === '' ? (null as any) : d.baseUrl;
    if (d.apiKey) p.apiKey = d.apiKey;
    if (d.isActive !== undefined) p.isActive = d.isActive;
    const saved = await this.repo.save(p);
    return this.mask(saved);
  }

  async updateStatus(id: string, isActive: boolean) {
    const p = await this.byId(id);
    p.isActive = isActive;
    return this.mask(await this.repo.save(p));
  }

  /**
   * Delete a provider and CASCADE-delete its models.
   * If the platform-wide default model lived inside, promote the oldest
   * remaining active model (of an active provider) so the platform never
   * ends up silently default-less.
   */
  async remove(id: string): Promise<{ deletedModelIds: string[] }> {
    const p = await this.byId(id);
    const models = await this.models.find({ where: { providerId: p.id } });
    const ids = models.map((m) => m.id);
    const swallowedPlatformDefault = models.some((m) => m.isDefault);
    if (ids.length) await this.models.delete({ id: In(ids) });
    await this.repo.remove(p);
    if (swallowedPlatformDefault) await this.reassignPlatformDefault();
    return { deletedModelIds: ids };
  }

  private async reassignPlatformDefault(): Promise<void> {
    await this.models.update({ isDefault: true }, { isDefault: false });
    const remaining = await this.models.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
    for (const candidate of remaining) {
      const prov = candidate.providerId
        ? await this.repo.findOne({ where: { id: candidate.providerId } })
        : null;
      if (!candidate.providerId || prov?.isActive) {
        await this.models.update({ id: candidate.id }, { isDefault: true });
        return;
      }
    }
  }

  /** Set the provider's default model (must belong to this provider, be active). */
  async setDefaultModel(id: string, modelId: string) {
    const p = await this.byId(id);
    let m: AiModel | undefined;
    try {
      m = (await this.models.findOne({ where: { id: modelId } })) ?? undefined;
    } catch (err: any) {
      if (err?.code !== '22P02') throw err;
    }
    if (!m) throw new BadRequestException('Model not found');
    const belongs = m.providerId === p.id || (!m.providerId && m.provider === p.name);
    if (!belongs) throw new BadRequestException('Model does not belong to this provider');
    if (m.isActive === false) throw new BadRequestException('Selected AI model is currently disabled');
    p.defaultModelId = m.id;
    return this.mask(await this.repo.save(p));
  }
}
