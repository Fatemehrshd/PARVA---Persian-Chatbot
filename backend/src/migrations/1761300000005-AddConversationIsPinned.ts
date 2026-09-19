import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConversationIsPinned1761300000005 implements MigrationInterface {
  name = 'AddConversationIsPinned1761300000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
        ADD COLUMN IF NOT EXISTS "isPinned" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
        DROP COLUMN IF EXISTS "isPinned"
    `);
  }
}
