import { MigrationInterface, QueryRunner } from 'typeorm';

const cp1252Map: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function fixUtf8MangledString(name: string): string {
  if (!name) return name;
  try {
    const bytes: number[] = [];
    for (let i = 0; i < name.length; i++) {
      const code = name.charCodeAt(i);
      if (cp1252Map[code] !== undefined) {
        bytes.push(cp1252Map[code]);
      } else if (code <= 0xff) {
        bytes.push(code);
      } else {
        return name;
      }
    }
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const decoded = decoder.decode(new Uint8Array(bytes));
    if (decoded && decoded !== name) {
      return decoded;
    }
  } catch {}
  return name;
}

export class FixMangledFilenames1761300000006 implements MigrationInterface {
  name = 'FixMangledFilenames1761300000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('file_attachments');
    if (!tableExists) return;

    const rows: Array<{ id: string; originalName: string }> = await queryRunner.query(
      `SELECT "id", "originalName" FROM "file_attachments" WHERE "originalName" LIKE '%Ø%'`,
    );

    for (const row of rows) {
      const fixed = fixUtf8MangledString(row.originalName);
      if (fixed !== row.originalName) {
        await queryRunner.query(
          `UPDATE "file_attachments" SET "originalName" = $1 WHERE "id" = $2`,
          [fixed, row.id],
        );
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-reversible data cleanup
  }
}
