import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExperienceComponents20260120120000 implements MigrationInterface {
  name = 'AddExperienceComponents20260120120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "experience_component" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" text NOT NULL,
        "name" text NOT NULL,
        "type" text NOT NULL,
        "schema_version" text NOT NULL DEFAULT '1',
        "data_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_experience_component_id" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_experience_component_key"
        ON "experience_component" ("key");

      CREATE INDEX IF NOT EXISTS "IDX_experience_component_type"
        ON "experience_component" ("type");

      ALTER TABLE "experience_block"
        ADD COLUMN IF NOT EXISTS "component_id" uuid;

      CREATE INDEX IF NOT EXISTS "IDX_experience_block_component"
        ON "experience_block" ("component_id");

      ALTER TABLE "experience_block"
        ADD CONSTRAINT "FK_experience_block_component"
        FOREIGN KEY ("component_id")
        REFERENCES "experience_component"("id")
        ON DELETE SET NULL
        ON UPDATE NO ACTION;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "experience_block" DROP CONSTRAINT IF EXISTS "FK_experience_block_component";
      DROP INDEX IF EXISTS "IDX_experience_block_component";
      ALTER TABLE "experience_block" DROP COLUMN IF EXISTS "component_id";
      DROP INDEX IF EXISTS "IDX_experience_component_type";
      DROP INDEX IF EXISTS "IDX_experience_component_key";
      DROP TABLE IF EXISTS "experience_component";
    `);
  }
}
