import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFileAttachmentsAndSoftDelete1761300000000 implements MigrationInterface {
  name = 'CreateFileAttachmentsAndSoftDelete1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations"
        ADD COLUMN IF NOT EXISTS "isDeleted" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      ALTER TABLE "messages"
        ADD COLUMN IF NOT EXISTS "isDeleted" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "conversationId" uuid,
        "messageId" uuid,
        "originalName" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "fileType" character varying NOT NULL DEFAULT 'image',
        "fileSize" bigint NOT NULL,
        "minioKey" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'processing',
        "errorMessage" text,
        "extractedText" text,
        "metadata" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_file_attachments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_file_attachments_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_file_attachments_conversationId" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_file_attachments_messageId" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL
      );
    `);

    // Insert default system settings for file upload if not present
    const settings = [
      { key: 'file_max_size_mb', value: '20' },
      { key: 'file_max_total_size_mb', value: '50' },
      { key: 'file_max_count', value: '5' },
      { key: 'excel_max_rows', value: '5000' },
      { key: 'file_processing_timeout_sec', value: '120' },
    ];

    for (const s of settings) {
      await queryRunner.query(`
        INSERT INTO "system_settings" ("key", "value")
        VALUES ('${s.key}', '${s.value}')
        ON CONFLICT ("key") DO NOTHING;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "file_attachments"`);
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN IF EXISTS "isDeleted"`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN IF EXISTS "isDeleted"`);
  }
}
