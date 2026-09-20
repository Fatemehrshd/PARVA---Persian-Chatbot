import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ensures the current platform default model is usable on the free plan. */
export class LinkDefaultModelToFreePlan1762300000000 implements MigrationInterface {
  name = 'LinkDefaultModelToFreePlan1762300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "plan_models" ("planId", "modelId")
      SELECT plan."id", model."id"
      FROM "subscription_plans" plan
      CROSS JOIN "ai_models" model
      WHERE plan."slug" = 'free'
        AND plan."isDefault" = true
        AND plan."isActive" = true
        AND plan."isDeleted" = false
        AND model."isDefault" = true
        AND model."isActive" = true
        AND model."isDeleted" = false
      ON CONFLICT ("planId", "modelId") DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "plan_models" link
      USING "subscription_plans" plan, "ai_models" model
      WHERE link."planId" = plan."id"
        AND link."modelId" = model."id"
        AND plan."slug" = 'free'
        AND model."isDefault" = true;
    `);
  }
}
