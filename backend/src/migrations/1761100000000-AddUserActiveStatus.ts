import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds admin-controlled account activation status. */
export class AddUserActiveStatus1761100000000 implements MigrationInterface {
  name = 'AddUserActiveStatus1761100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "isActive" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isActive"`);
  }
}
