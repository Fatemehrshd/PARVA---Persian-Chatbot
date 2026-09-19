import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Coupon, DiscountType } from './coupon.entity';
import { CouponUsage } from './coupon-usage.entity';

export interface CreateCouponDto {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number;
  expiresAt?: Date | string | null;
  isActive?: boolean;
}

export interface UpdateCouponDto {
  description?: string;
  discountType?: DiscountType;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  usageLimit?: number | null;
  perUserLimit?: number;
  expiresAt?: Date | string | null;
  isActive?: boolean;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private couponRepo: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private usageRepo: Repository<CouponUsage>,
  ) {}

  /**
   * Normalizes coupon code to trimmed uppercase
   */
  normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  async create(dto: CreateCouponDto): Promise<Coupon> {
    const code = this.normalizeCode(dto.code);
    const existing = await this.couponRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`کد تخفیف «${code}» قبلاً ثبت شده است.`);
    }

    if (dto.discountType === 'PERCENTAGE' && (dto.discountValue <= 0 || dto.discountValue > 100)) {
      throw new BadRequestException('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.');
    }

    if (dto.discountType === 'FIXED' && dto.discountValue <= 0) {
      throw new BadRequestException('مبلغ تخفیف باید بزرگتر از صفر باشد.');
    }

    const coupon = this.couponRepo.create({
      ...dto,
      code,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      perUserLimit: dto.perUserLimit ?? 1,
      isActive: dto.isActive ?? true,
    });

    return this.couponRepo.save(coupon);
  }

  async findAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const page = params?.page && params.page > 0 ? Number(params.page) : 1;
    const limit = params?.limit && params.limit > 0 ? Number(params.limit) : 10;
    const skip = (page - 1) * limit;

    const qb = this.couponRepo.createQueryBuilder('c');

    if (params?.search) {
      qb.andWhere('(c.code ILIKE :search OR c.description ILIKE :search)', {
        search: `%${params.search}%`,
      });
    }

    if (params?.isActive !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive: params.isActive });
    }

    qb.orderBy('c.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id: string): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('کد تخفیف یافت نشد.');
    }
    return coupon;
  }

  async findByCode(code: string): Promise<Coupon | null> {
    return this.couponRepo.findOne({
      where: { code: this.normalizeCode(code) },
    });
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.findById(id);

    if (dto.discountType === 'PERCENTAGE' && dto.discountValue !== undefined) {
      if (dto.discountValue <= 0 || dto.discountValue > 100) {
        throw new BadRequestException('درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.');
      }
    }

    if (dto.discountType === 'FIXED' && dto.discountValue !== undefined) {
      if (dto.discountValue <= 0) {
        throw new BadRequestException('مبلغ تخفیف باید بزرگتر از صفر باشد.');
      }
    }

    Object.assign(coupon, {
      ...dto,
      expiresAt: dto.expiresAt !== undefined ? (dto.expiresAt ? new Date(dto.expiresAt) : null) : coupon.expiresAt,
    });

    return this.couponRepo.save(coupon);
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const coupon = await this.findById(id);
    await this.couponRepo.remove(coupon);
    return { success: true, message: 'کد تخفیف با موفقیت حذف شد.' };
  }

  /**
   * Validates a coupon for a specific user and plan price.
   * Returns exact discount amount and final payable price.
   */
  async validateCoupon(code: string, planPrice: number, userId: string) {
    const normalized = this.normalizeCode(code);
    const coupon = await this.couponRepo.findOne({ where: { code: normalized } });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('کد تخفیف وارد شده معتبر نیست یا غیرفعال شده است.');
    }

    const now = new Date();
    if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
      throw new BadRequestException('مهلت استفاده از این کد تخفیف به پایان رسیده است.');
    }

    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('سقف کل استفاده از این کد تخفیف به پایان رسیده است.');
    }

    if (coupon.minOrderAmount && planPrice < Number(coupon.minOrderAmount)) {
      throw new BadRequestException(
        `این کد تخفیف برای سفارش‌های بالاتر از ${Number(coupon.minOrderAmount).toLocaleString('fa-IR')} ریال معتبر است.`,
      );
    }

    // Check per-user limit
    const userUsages = await this.usageRepo.count({
      where: { couponId: coupon.id, userId },
    });

    if (userUsages >= coupon.perUserLimit) {
      throw new BadRequestException('شما قبلاً از این کد تخفیف استفاده کرده‌اید.');
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      const calculated = (planPrice * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscountAmount && Number(coupon.maxDiscountAmount) > 0) {
        discountAmount = Math.min(calculated, Number(coupon.maxDiscountAmount));
      } else {
        discountAmount = calculated;
      }
    } else {
      // FIXED amount
      discountAmount = Math.min(planPrice, Number(coupon.discountValue));
    }

    discountAmount = Math.round(discountAmount);
    const finalAmount = Math.max(0, planPrice - discountAmount);

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount,
      originalAmount: planPrice,
      finalAmount,
      message: `کد تخفیف با موفقیت اعمال شد (${discountAmount.toLocaleString('fa-IR')} ریال تخفیف).`,
    };
  }

  /**
   * Records successful usage of a coupon inside a transaction
   */
  async recordUsage(
    couponId: string,
    userId: string,
    paymentId: string,
    discountAmount: number,
    manager?: EntityManager,
  ) {
    const usageRepo = manager ? manager.getRepository(CouponUsage) : this.usageRepo;
    const couponRepo = manager ? manager.getRepository(Coupon) : this.couponRepo;

    const usage = usageRepo.create({
      couponId,
      userId,
      paymentId,
      discountAmount,
    });
    await usageRepo.save(usage);

    await couponRepo.increment({ id: couponId }, 'usedCount', 1);
  }
}
