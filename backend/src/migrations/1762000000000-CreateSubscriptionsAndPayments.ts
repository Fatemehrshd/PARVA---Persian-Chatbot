import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionsAndPayments1762000000000 implements MigrationInterface {
  name = 'CreateSubscriptionsAndPayments1762000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "subscription_status_enum" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "payment_status_enum" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // 2. subscription_plans
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" varchar(50) NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "price" bigint NOT NULL DEFAULT 0,
        "currency" varchar(10) NOT NULL DEFAULT 'IRR',
        "durationDays" integer NOT NULL DEFAULT 30,
        "tokenQuota" integer NOT NULL DEFAULT 0,
        "messageQuota" integer,
        "resetHours" integer NOT NULL DEFAULT 6,
        "features" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "isDefault" boolean NOT NULL DEFAULT false,
        "sortOrder" integer NOT NULL DEFAULT 0,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_plans_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_subscription_plans_slug" UNIQUE ("slug")
      );
    `);

    // 3. plan_models
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plan_models" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "planId" uuid NOT NULL,
        "modelId" uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_plan_models_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_plan_models_plan_model" UNIQUE ("planId", "modelId"),
        CONSTRAINT "FK_plan_models_planId" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_plan_models_modelId" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE CASCADE
      );
    `);

    // 4. payments
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "planId" uuid NOT NULL,
        "amount" bigint NOT NULL,
        "currency" varchar(10) NOT NULL DEFAULT 'IRR',
        "status" "payment_status_enum" NOT NULL DEFAULT 'PENDING',
        "gateway" varchar(50) NOT NULL DEFAULT 'sandbox',
        "authority" varchar(100),
        "refId" varchar(100),
        "idempotencyKey" varchar(100),
        "ip" text,
        "userAgent" text,
        "verifiedAt" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_authority" UNIQUE ("authority"),
        CONSTRAINT "UQ_payments_idempotencyKey" UNIQUE ("idempotencyKey"),
        CONSTRAINT "FK_payments_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_planId" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT
      );
    `);

    // 5. subscriptions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "planId" uuid NOT NULL,
        "status" "subscription_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "endDate" TIMESTAMP WITH TIME ZONE,
        "paymentId" uuid,
        "source" varchar(30) NOT NULL DEFAULT 'purchase',
        "cancelledAt" TIMESTAMP WITH TIME ZONE,
        "cancellationReason" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscriptions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_subscriptions_planId" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_subscriptions_paymentId" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_subscriptions_userId_status" ON "subscriptions" ("userId", "status");
    `);

    // 6. audit_logs
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actorId" uuid,
        "actorType" varchar(30) NOT NULL DEFAULT 'user',
        "action" varchar(100) NOT NULL,
        "entityType" varchar(50) NOT NULL,
        "entityId" text,
        "changes" jsonb,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "ip" text,
        "userAgent" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_actorId" ON "audit_logs" ("actorId");
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_action" ON "audit_logs" ("action");
      CREATE INDEX IF NOT EXISTS "IDX_audit_logs_entityType" ON "audit_logs" ("entityType");
    `);

    // 7. Seed default Free plan if not exists
    await queryRunner.query(`
      INSERT INTO "subscription_plans" ("slug", "name", "description", "price", "currency", "durationDays", "tokenQuota", "messageQuota", "resetHours", "features", "isActive", "isDefault", "sortOrder")
      VALUES ('free', 'طرح رایگان', 'طرح پایه برای تمام کاربران با دسترسی به مدل‌های عمومی', 0, 'IRR', 0, 0, NULL, 6, '{"webSearch": false, "thinking": false, "document": false}'::jsonb, true, true, 0)
      ON CONFLICT ("slug") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plan_models"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_plans"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "subscription_status_enum"`);
  }
}
