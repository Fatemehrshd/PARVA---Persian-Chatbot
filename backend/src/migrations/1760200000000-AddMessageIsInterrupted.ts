import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add isInterrupted column to messages table for streaming resilience & resume.
 */
export class AddMessageIsInterrupted1760200000000 implements MigrationInterface {
  name = 'AddMessageIsInterrupted1760200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD COLUMN IF NOT EXISTS "isInterrupted" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN IF EXISTS "isInterrupted"`);
  }
}
