import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds periodic-quota columns (hourly lazy reset) + per-task-type usage buckets. */
export class AddUserPeriodicQuota1761500000000 implements MigrationInterface {
  name = 'AddUserPeriodicQuota1761500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "messageLimit" integer DEFAULT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "periodStart" timestamptz DEFAULT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "periodUsedTokens" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "periodUsedMessages" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "usageByType" jsonb NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "usageByType"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "periodUsedMessages"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "periodUsedTokens"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "periodStart"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "messageLimit"`);
  }
}
