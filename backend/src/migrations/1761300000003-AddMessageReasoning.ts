import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores model reasoning/thinking content and elapsed duration alongside assistant messages. */
export class AddMessageReasoning1761300000003 implements MigrationInterface {
  name = 'AddMessageReasoning1761300000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD COLUMN IF NOT EXISTS "reasoning_content" text NULL DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS "thinking_duration_ms" integer NULL DEFAULT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "messages"
        DROP COLUMN IF EXISTS "thinking_duration_ms",
        DROP COLUMN IF EXISTS "reasoning_content"
    `);
  }
}
