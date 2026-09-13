import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiModel } from './ai-model.entity';
@Injectable()
export class ModelsAdminService {
  constructor(@InjectRepository(AiModel) private repo: Repository<AiModel>) {}
  list() {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }
  create(d: Partial<AiModel>) {
    return this.repo.save(this.repo.create({ isActive: true, ...d }));
  }
  async remove(id: string) {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Resource not found');
    await this.repo.remove(m);
  }
  async setDefault(id: string) {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Resource not found');
    await this.repo.update({}, { isDefault: false });
    m.isDefault = true;
    return this.repo.save(m);
  }
  async getDefault(): Promise<AiModel | null> {
    return this.repo.findOne({ where: { isDefault: true } });
  }
}
