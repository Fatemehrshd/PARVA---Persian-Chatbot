import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds per-user theme preference ('dark' | 'light'). Null = use global default. */
export class AddUserThemePreference1762400000000 implements MigrationInterface {
  name = 'AddUserThemePreference1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "themePreference" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "themePreference"`);
  }
}