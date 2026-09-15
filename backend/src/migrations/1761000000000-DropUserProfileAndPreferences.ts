import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropUserProfileAndPreferences1761000000000 implements MigrationInterface {
  name = 'DropUserProfileAndPreferences1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "bio"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "defaultModelId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "timezone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "theme"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "language"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "bio" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "language" character varying NOT NULL DEFAULT 'fa'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "theme" character varying NOT NULL DEFAULT 'dark'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "timezone" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "defaultModelId" character varying`);
  }
}
