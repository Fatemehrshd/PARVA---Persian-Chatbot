import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModelCapabilities1761300000002 implements MigrationInterface {
  name = 'AddModelCapabilities1761300000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "supportsThinking" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "supportsVision" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "supportsDocument" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "thinkingBudgetTokens" integer NULL DEFAULT null`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "thinkingBudgetTokens"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "supportsDocument"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "supportsVision"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "supportsThinking"`);
  }
}
