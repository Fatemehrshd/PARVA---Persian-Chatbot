import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableThinkingDefault1761300000004 implements MigrationInterface {
  name = 'EnableThinkingDefault1761300000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_models" ALTER COLUMN "supportsThinking" SET DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "ai_models" SET "supportsThinking" = false WHERE "supportsThinking" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_models" ALTER COLUMN "supportsThinking" SET DEFAULT true`,
    );
    await queryRunner.query(
      `UPDATE "ai_models" SET "supportsThinking" = true WHERE "supportsThinking" = false`,
    );
  }
}
