import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExperiencePages20260203120000 implements MigrationInterface {
  name = 'AddExperiencePages20260203120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "experience_page" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "key" text NOT NULL,
        "locale" text NULL,
        "version" text NOT NULL DEFAULT '1',
        "status" text NOT NULL DEFAULT 'DRAFT',
        "is_active" boolean NOT NULL DEFAULT true,
        "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "seo_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_experience_page_key_locale_version"
        ON "experience_page" ("key", "locale", "version");
      CREATE INDEX IF NOT EXISTS "IDX_experience_page_key_status"
        ON "experience_page" ("key", "status");
      CREATE INDEX IF NOT EXISTS "IDX_experience_page_locale_status"
        ON "experience_page" ("locale", "status");

      CREATE TABLE IF NOT EXISTS "experience_block" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "page_id" uuid NOT NULL,
        "key" text NOT NULL,
        "type" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "priority" int NOT NULL DEFAULT 0,
        "order" int NOT NULL DEFAULT 0,
        "start_at" timestamptz NULL,
        "end_at" timestamptz NULL,
        "data_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "responsive_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "render_hint" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_experience_block_page" FOREIGN KEY ("page_id")
          REFERENCES "experience_page"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_experience_block_page_key"
        ON "experience_block" ("page_id", "key");
      CREATE INDEX IF NOT EXISTS "IDX_experience_block_page_order"
        ON "experience_block" ("page_id", "order");
      CREATE INDEX IF NOT EXISTS "IDX_experience_block_page_enabled"
        ON "experience_block" ("page_id", "enabled");
      CREATE INDEX IF NOT EXISTS "IDX_experience_block_schedule"
        ON "experience_block" ("start_at", "end_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "experience_block";
      DROP TABLE IF EXISTS "experience_page";
    `);
  }
}

