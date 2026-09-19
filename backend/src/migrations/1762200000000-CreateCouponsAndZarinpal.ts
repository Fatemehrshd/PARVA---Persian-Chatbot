import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCouponsAndZarinpal1762200000000 implements MigrationInterface {
  name = 'CreateCouponsAndZarinpal1762200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create coupons table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(64) NOT NULL,
        "description" character varying(255),
        "discountType" character varying(20) NOT NULL DEFAULT 'PERCENTAGE',
        "discountValue" numeric(12, 2) NOT NULL,
        "maxDiscountAmount" numeric(12, 2),
        "minOrderAmount" numeric(12, 2),
        "usageLimit" integer,
        "usedCount" integer NOT NULL DEFAULT 0,
        "perUserLimit" integer NOT NULL DEFAULT 1,
        "expiresAt" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupons_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_coupons_code" UNIQUE ("code")
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_coupons_code" ON "coupons" ("code");
    `);

    // 2. Add columns to payments table
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "originalAmount" character varying,
      ADD COLUMN IF NOT EXISTS "discountAmount" character varying NOT NULL DEFAULT '0',
      ADD COLUMN IF NOT EXISTS "couponId" uuid;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_payments_couponId'
        ) THEN
          ALTER TABLE "payments"
          ADD CONSTRAINT "FK_payments_couponId"
          FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // 3. Create coupon_usages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coupon_usages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "couponId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "paymentId" uuid,
        "discountAmount" numeric(12, 2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coupon_usages_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_coupon_usages_couponId" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coupon_usages_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_coupon_usages_paymentId" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_coupon_usages_coupon_user" ON "coupon_usages" ("couponId", "userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "coupon_usages"`);
    await queryRunner.query(`
      ALTER TABLE "payments"
      DROP CONSTRAINT IF EXISTS "FK_payments_couponId",
      DROP COLUMN IF EXISTS "couponId",
      DROP COLUMN IF EXISTS "discountAmount",
      DROP COLUMN IF EXISTS "originalAmount";
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "coupons"`);
  }
}
