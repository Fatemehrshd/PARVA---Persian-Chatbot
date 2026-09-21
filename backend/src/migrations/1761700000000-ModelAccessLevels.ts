import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Model access control: every model carries an accessLevel
 * (public | commercial | private) plus a user whitelist for private models.
 * Existing models default to 'public' so nobody loses access on upgrade.
 */
export class ModelAccessLevels1761700000000 implements MigrationInterface {
  name = 'ModelAccessLevels1761700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ai_models"
        ADD COLUMN IF NOT EXISTS "accessLevel" varchar NOT NULL DEFAULT 'public';
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_models"
        ADD COLUMN IF NOT EXISTS "allowedUserIds" jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "allowedUserIds"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "accessLevel"`);
  }
}
