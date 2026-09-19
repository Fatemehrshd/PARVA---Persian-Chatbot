import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { PlanModel } from './plan-model.entity';
import { AiModel } from '../models-admin/ai-model.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PlansService implements OnModuleInit {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private planRepo: Repository<SubscriptionPlan>,
    @InjectRepository(PlanModel)
    private planModelRepo: Repository<PlanModel>,
    @InjectRepository(AiModel)
    private aiModelRepo: Repository<AiModel>,
    private auditService: AuditService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaultPlans();
    } catch {
      // ignore if DB is not ready during test bootstrap
    }
  }

  async seedDefaultPlans(): Promise<void> {
    const count = await this.planRepo.count({ where: { isDeleted: false } });
    if (count > 0) return;

    const free = await this.planRepo.save(
      this.planRepo.create({
        slug: 'free',
        name: 'طرح پایه (رایگان)',
        description: 'دسترسی به مدل‌های عمومی و سهمیه استاندارد سیستم',
        price: '0',
        currency: 'IRR',
        durationDays: 0,
        tokenQuota: 0,
        messageQuota: null,
        resetHours: 6,
        features: { webSearch: false, thinking: false, document: false },
        isActive: true,
        isDefault: true,
        sortOrder: 1,
      }),
    );

    const pro = await this.planRepo.save(
      this.planRepo.create({
        slug: 'pro',
        name: 'طرح حرفه‌ای (Pro)',
        description: 'دسترسی به تفکر عمیق (Deep Thinking)، وب‌سرچ زنده و تحلیل اسناد',
        price: '4900000',
        currency: 'IRR',
        durationDays: 30,
        tokenQuota: 2000000,
        messageQuota: 200,
        resetHours: 6,
        features: { webSearch: true, thinking: true, document: true },
        isActive: true,
        isDefault: false,
        sortOrder: 2,
      }),
    );

    const ent = await this.planRepo.save(
      this.planRepo.create({
        slug: 'enterprise',
        name: 'طرح سازمانی (Enterprise)',
        description: 'بالاترین اولویت پردازش، سقف توکن نامحدود و دسترسی به کلیه امکانات',
        price: '19900000',
        currency: 'IRR',
        durationDays: 90,
        tokenQuota: 10000000,
        messageQuota: 1000,
        resetHours: 6,
        features: { webSearch: true, thinking: true, document: true },
        isActive: true,
        isDefault: false,
        sortOrder: 3,
      }),
    );

    const models = await this.aiModelRepo.find({ where: { isDeleted: false } });
    if (models.length > 0) {
      const proModels = models.map((m) =>
        this.planModelRepo.create({ planId: pro.id, modelId: m.id }),
      );
      const entModels = models.map((m) =>
        this.planModelRepo.create({ planId: ent.id, modelId: m.id }),
      );
      await this.planModelRepo.save([...proModels, ...entModels]);
    }
  }

  async findAll(includeInactive = false): Promise<SubscriptionPlan[]> {
    const qb = this.planRepo
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.planModels', 'planModel')
      .leftJoinAndSelect('planModel.model', 'model')
      .where('plan.isDeleted = :isDeleted', { isDeleted: false });

    if (!includeInactive) {
      qb.andWhere('plan.isActive = :isActive', { isActive: true });
    }

    qb.orderBy('plan.sortOrder', 'ASC').addOrderBy('plan.createdAt', 'ASC');
    return qb.getMany();
  }

  async findById(id: string): Promise<SubscriptionPlan> {
    const plan = await this.planRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['planModels', 'planModels.model'],
    });
    if (!plan) {
      throw new NotFoundException(`پلن اشتراک با شناسه ${id} یافت نشد.`);
    }
    return plan;
  }

  async findBySlug(slug: string): Promise<SubscriptionPlan | null> {
    return this.planRepo.findOne({
      where: { slug, isDeleted: false },
      relations: ['planModels', 'planModels.model'],
    });
  }

  async findDefaultPlan(): Promise<SubscriptionPlan | null> {
    return this.planRepo.findOne({
      where: { isDefault: true, isActive: true, isDeleted: false },
      relations: ['planModels', 'planModels.model'],
    });
  }

  async create(dto: CreatePlanDto, actorId?: string): Promise<SubscriptionPlan> {
    const existing = await this.planRepo.findOne({
      where: { slug: dto.slug, isDeleted: false },
    });
    if (existing) {
      throw new BadRequestException(`پلنی با شناسه سیستمی (slug) "${dto.slug}" از قبل وجود دارد.`);
    }

    if (dto.isDefault) {
      await this.planRepo.update({ isDefault: true }, { isDefault: false });
    }

    const plan = this.planRepo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description || null,
      price: String(dto.price || 0),
      currency: dto.currency || 'IRR',
      durationDays: dto.durationDays ?? 30,
      tokenQuota: dto.tokenQuota ?? 0,
      messageQuota: dto.messageQuota ?? null,
      resetHours: dto.resetHours ?? 6,
      features: dto.features || {},
      isActive: dto.isActive ?? true,
      isDefault: dto.isDefault ?? false,
      sortOrder: dto.sortOrder ?? 0,
    });

    const savedPlan = await this.planRepo.save(plan);

    if (dto.modelIds && dto.modelIds.length > 0) {
      await this.setPlanModels(savedPlan.id, dto.modelIds);
    }

    await this.auditService.log({
      actorId,
      actorType: 'admin',
      action: 'plan.created',
      entityType: 'plan',
      entityId: savedPlan.id,
      changes: { after: savedPlan },
      metadata: { slug: savedPlan.slug, name: savedPlan.name },
    });

    return this.findById(savedPlan.id);
  }

  async update(id: string, dto: UpdatePlanDto, actorId?: string): Promise<SubscriptionPlan> {
    const plan = await this.findById(id);
    const before = { ...plan };

    if (dto.isDefault && !plan.isDefault) {
      await this.planRepo.update({ isDefault: true }, { isDefault: false });
    }

    if (dto.slug && dto.slug !== plan.slug) {
      const existing = await this.planRepo.findOne({ where: { slug: dto.slug, isDeleted: false } });
      if (existing) {
        throw new BadRequestException(`پلنی با شناسه سیستمی (slug) "${dto.slug}" از قبل وجود دارد.`);
      }
      plan.slug = dto.slug;
    }

    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.price !== undefined) plan.price = String(dto.price);
    if (dto.currency !== undefined) plan.currency = dto.currency;
    if (dto.durationDays !== undefined) plan.durationDays = dto.durationDays;
    if (dto.tokenQuota !== undefined) plan.tokenQuota = dto.tokenQuota;
    if (dto.messageQuota !== undefined) plan.messageQuota = dto.messageQuota;
    if (dto.resetHours !== undefined) plan.resetHours = dto.resetHours;
    if (dto.features !== undefined) plan.features = dto.features;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;
    if (dto.isDefault !== undefined) plan.isDefault = dto.isDefault;
    if (dto.sortOrder !== undefined) plan.sortOrder = dto.sortOrder;

    await this.planRepo.save(plan);

    if (dto.modelIds !== undefined) {
      await this.setPlanModels(plan.id, dto.modelIds);
    }

    const updated = await this.findById(plan.id);

    await this.auditService.log({
      actorId,
      actorType: 'admin',
      action: 'plan.updated',
      entityType: 'plan',
      entityId: plan.id,
      changes: { before, after: updated },
      metadata: { slug: plan.slug },
    });

    return updated;
  }

  async setPlanModels(planId: string, modelIds: string[]): Promise<void> {
    await this.planModelRepo.delete({ planId });
    if (!modelIds || modelIds.length === 0) return;

    const validModels = await this.aiModelRepo.find({
      where: { id: In(modelIds), isDeleted: false },
    });

    const entries = validModels.map((m) =>
      this.planModelRepo.create({
        planId,
        modelId: m.id,
      }),
    );

    if (entries.length > 0) {
      await this.planModelRepo.save(entries);
    }
  }

  async delete(id: string, actorId?: string): Promise<void> {
    const plan = await this.findById(id);
    if (plan.isDefault) {
      throw new BadRequestException('امکان حذف پلن پیش‌فرض سیستم وجود ندارد.');
    }

    plan.isDeleted = true;
    plan.isActive = false;
    await this.planRepo.save(plan);

    await this.auditService.log({
      actorId,
      actorType: 'admin',
      action: 'plan.deleted',
      entityType: 'plan',
      entityId: plan.id,
      metadata: { slug: plan.slug, name: plan.name },
    });
  }
}
