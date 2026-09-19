import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft-delete for administrative entities (users, ai_models, ai_providers).
 * Physical FK cascades from users become SET NULL so a future hard purge
 * never destroys historical conversations/attachments.
 */
export class SoftDeleteUsersModelsProviders1761600000000 implements MigrationInterface {
  name = 'SoftDeleteUsersModelsProviders1761600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "isDeleted" boolean NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_models"
        ADD COLUMN IF NOT EXISTS "isDeleted" boolean NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      ALTER TABLE "ai_providers"
        ADD COLUMN IF NOT EXISTS "isDeleted" boolean NOT NULL DEFAULT false;
    `);

    // conversations.userId: CASCADE -> SET NULL (keep history after purge)
    await queryRunner.query(`
      ALTER TABLE "conversations" ALTER COLUMN "userId" DROP NOT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
        DROP CONSTRAINT IF EXISTS "FK_conversations_userId";
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
        ADD CONSTRAINT "FK_conversations_userId"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
    `);

    // file_attachments.userId: CASCADE -> SET NULL (keep files after purge)
    await queryRunner.query(`
      ALTER TABLE "file_attachments" ALTER COLUMN "userId" DROP NOT NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "file_attachments"
        DROP CONSTRAINT IF EXISTS "FK_file_attachments_userId";
    `);
    await queryRunner.query(`
      ALTER TABLE "file_attachments"
        ADD CONSTRAINT "FK_file_attachments_userId"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "file_attachments"
        DROP CONSTRAINT IF EXISTS "FK_file_attachments_userId";
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations"
        DROP CONSTRAINT IF EXISTS "FK_conversations_userId";
    `);
    await queryRunner.query(`ALTER TABLE "ai_providers" DROP COLUMN IF EXISTS "isDeleted"`);
    await queryRunner.query(`ALTER TABLE "ai_models" DROP COLUMN IF EXISTS "isDeleted"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isDeleted"`);
  }
}
