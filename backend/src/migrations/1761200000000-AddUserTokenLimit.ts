import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds admin-configurable per-user token limit. */
export class AddUserTokenLimit1761200000000 implements MigrationInterface {
  name = 'AddUserTokenLimit1761200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "tokenLimit" integer DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "tokenLimit"`);
  }
}
