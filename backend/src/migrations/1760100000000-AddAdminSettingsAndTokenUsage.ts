import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin settings and user token usage tracking (Task 16).
 */
export class AddAdminSettingsAndTokenUsage1760100000000 implements MigrationInterface {
  name = 'AddAdminSettingsAndTokenUsage1760100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "usedTokens" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" character varying NOT NULL,
        "value" text NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_settings_key" PRIMARY KEY ("key")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "system_settings" ("key", "value")
      VALUES
        ('global_token_limit', '0'),
        ('system_prompt', 'You are a helpful and knowledgeable AI assistant.')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "system_settings"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "usedTokens"`);
  }
}
