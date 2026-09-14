import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModel } from './ai-model.entity';
@Injectable()
export class ModelsAdminService {
  constructor(@InjectRepository(AiModel) private repo: Repository<AiModel>) {}

  private maskApiKey(m: AiModel): AiModel {
    if (!m) return m;
    if (m.apiKey && m.apiKey.length > 8) {
      const visible = m.apiKey.slice(-4);
      return { ...m, apiKey: `sk-...${visible}` } as AiModel;
    } else if (m.apiKey) {
      return { ...m, apiKey: '***' } as AiModel;
    }
    return m;
  }

  async list() {
    const models = await this.repo.find({ order: { createdAt: 'ASC' } });
    return models.map((m) => this.maskApiKey(m));
  }

  async listActive() {
    const models = await this.repo.find({ where: { isActive: true }, order: { createdAt: 'ASC' } });
    return models.map((m) => this.maskApiKey(m));
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

  async create(d: Partial<AiModel>) {
    const m = await this.repo.save(this.repo.create({ isActive: true, ...d }));
    return this.maskApiKey(m);
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
    await this.repo.update({}, { isDefault: false });
    m.isDefault = true;
    const saved = await this.repo.save(m);
    return this.maskApiKey(saved);
  }

  async getDefault(): Promise<AiModel | null> {
    return this.repo.findOne({ where: { isDefault: true } });
  }
}
