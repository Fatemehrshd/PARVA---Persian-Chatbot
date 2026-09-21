import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { User } from '../modules/users/user.entity';
import { Conversation } from '../modules/chat/conversation.entity';
import { Message } from '../modules/chat/message.entity';
import { AiModel } from '../modules/models-admin/ai-model.entity';
import { AiProvider } from '../modules/models-admin/ai-provider.entity';
import { SystemSetting } from '../modules/admin/system-setting.entity';
import { FileAttachment } from '../modules/files/file-attachment.entity';
import { SubscriptionPlan } from '../modules/subscriptions/subscription-plan.entity';
import { PlanModel } from '../modules/subscriptions/plan-model.entity';
import { Subscription, SubscriptionStatus } from '../modules/subscriptions/subscription.entity';
import { Payment } from '../modules/payments/payment.entity';
import { AuditLog } from '../modules/audit/audit-log.entity';

async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'postgres',
    database: process.env.DB_NAME || 'codeless',
    entities: [
      User,
      Conversation,
      Message,
      AiModel,
      AiProvider,
      SystemSetting,
      FileAttachment,
      SubscriptionPlan,
      PlanModel,
      Subscription,
      Payment,
      AuditLog,
    ],
    synchronize: (process.env.DB_SYNC ?? 'true') === 'true',
  });

  await ds.initialize();
  console.log('Connected to database.');

  const planRepo = ds.getRepository(SubscriptionPlan);
  const planModelRepo = ds.getRepository(PlanModel);
  const aiModelRepo = ds.getRepository(AiModel);
  const userRepo = ds.getRepository(User);
  const subRepo = ds.getRepository(Subscription);

  // 1. Seed or get Plans
  let free = await planRepo.findOne({ where: { slug: 'free', isDeleted: false } });
  if (!free) {
    free = await planRepo.save(
      planRepo.create({
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
    console.log('Created Free plan');
  }

  let pro = await planRepo.findOne({ where: { slug: 'pro', isDeleted: false } });
  if (!pro) {
    pro = await planRepo.save(
      planRepo.create({
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
    console.log('Created Pro plan');
  }

  let ent = await planRepo.findOne({ where: { slug: 'enterprise', isDeleted: false } });
  if (!ent) {
    ent = await planRepo.save(
      planRepo.create({
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
    console.log('Created Enterprise plan');
  }

  // 2. Link active models
  const models = await aiModelRepo.find({ where: { isDeleted: false } });
  if (models.length > 0) {
    for (const m of models) {
      const existsPro = await planModelRepo.findOne({ where: { planId: pro.id, modelId: m.id } });
      if (!existsPro) {
        await planModelRepo.save(planModelRepo.create({ planId: pro.id, modelId: m.id }));
      }
      const existsEnt = await planModelRepo.findOne({ where: { planId: ent.id, modelId: m.id } });
      if (!existsEnt) {
        await planModelRepo.save(planModelRepo.create({ planId: ent.id, modelId: m.id }));
      }
    }
  }

  // 3. Assign subscriptions to users
  const users = await userRepo.find({ where: { isDeleted: false } });
  console.log(`Found ${users.length} users in system.`);

  for (const u of users) {
    const activeSub = await subRepo.findOne({
      where: { userId: u.id, status: SubscriptionStatus.ACTIVE },
    });

    if (!activeSub) {
      const chosenPlan = u.role === 'admin' ? ent : (Math.random() > 0.5 ? pro : free);
      const duration = chosenPlan.durationDays;
      const startDate = new Date();
      const endDate = duration > 0 ? new Date(startDate.getTime() + duration * 86400000) : null;

      await subRepo.save(
        subRepo.create({
          userId: u.id,
          planId: chosenPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          source: 'admin_manual',
        }),
      );
      console.log(`Assigned ${chosenPlan.name} to ${u.displayName || u.email}`);
    } else {
      console.log(`User ${u.displayName || u.email} already has active subscription.`);
    }
  }

  console.log('Seeding completed successfully!');
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
