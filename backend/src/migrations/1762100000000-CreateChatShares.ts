import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatShares1762100000000 implements MigrationInterface {
  name = 'CreateChatShares1762100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chat_shares" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "shareCode" character varying(32) NOT NULL,
        "conversationId" uuid,
        "userId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "modelId" character varying,
        "modelName" character varying,
        "snapshotMessages" jsonb NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "viewCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_shares_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_chat_shares_shareCode" UNIQUE ("shareCode"),
        CONSTRAINT "FK_chat_shares_conversationId" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_chat_shares_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_shares_shareCode" ON "chat_shares" ("shareCode");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_shares_conversationId" ON "chat_shares" ("conversationId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_chat_shares_userId" ON "chat_shares" ("userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_shares"`);
  }
}
