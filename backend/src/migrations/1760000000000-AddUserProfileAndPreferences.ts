import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * User profile & preferences columns (Task 15).
 * Hand-written SQL kept in sync with the User entity; dev still runs with
 * DB_SYNC=true, this migration is the production path.
 */
export class AddUserProfileAndPreferences1760000000000 implements MigrationInterface {
  name = 'AddUserProfileAndPreferences1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "username" character varying,
        ADD COLUMN IF NOT EXISTS "bio" text,
        ADD COLUMN IF NOT EXISTS "avatarUrl" character varying,
        ADD COLUMN IF NOT EXISTS "avatarKey" character varying,
        ADD COLUMN IF NOT EXISTS "language" character varying NOT NULL DEFAULT 'fa',
        ADD COLUMN IF NOT EXISTS "theme" character varying NOT NULL DEFAULT 'dark',
        ADD COLUMN IF NOT EXISTS "timezone" character varying,
        ADD COLUMN IF NOT EXISTS "defaultModelId" character varying
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_username" ON "users" ("username")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_username"`);
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN IF EXISTS "username",
        DROP COLUMN IF EXISTS "bio",
        DROP COLUMN IF EXISTS "avatarUrl",
        DROP COLUMN IF EXISTS "avatarKey",
        DROP COLUMN IF EXISTS "language",
        DROP COLUMN IF EXISTS "theme",
        DROP COLUMN IF EXISTS "timezone",
        DROP COLUMN IF EXISTS "defaultModelId"
    `);
  }
}
