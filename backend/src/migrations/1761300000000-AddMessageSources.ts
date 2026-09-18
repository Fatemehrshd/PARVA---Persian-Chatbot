import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores web-search sources alongside the assistant message that cited them. */
export class AddMessageSources1761300000000 implements MigrationInterface {
  name = 'AddMessageSources1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD COLUMN IF NOT EXISTS "sources" jsonb NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN IF EXISTS "sources"`);
  }
}
