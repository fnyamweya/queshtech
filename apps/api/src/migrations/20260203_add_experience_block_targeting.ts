import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExperienceBlockTargeting20260203121000 implements MigrationInterface {
  name = 'AddExperienceBlockTargeting20260203121000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "experience_block"
        ADD COLUMN IF NOT EXISTS "schema_version" text NOT NULL DEFAULT '1',
        ADD COLUMN IF NOT EXISTS "targeting_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS "experiment_json" jsonb NOT NULL DEFAULT '{}'::jsonb;

      CREATE INDEX IF NOT EXISTS "IDX_experience_block_schema" ON "experience_block" ("type", "schema_version");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_experience_block_schema";
      ALTER TABLE "experience_block"
        DROP COLUMN IF EXISTS "experiment_json",
        DROP COLUMN IF EXISTS "targeting_json",
        DROP COLUMN IF EXISTS "schema_version";
    `);
  }
}
