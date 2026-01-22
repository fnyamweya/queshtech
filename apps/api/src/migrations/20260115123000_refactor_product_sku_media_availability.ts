import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorProductSkuMediaAvailability20260115123000
  implements MigrationInterface
{
  name = 'RefactorProductSkuMediaAvailability20260115123000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "seo_title" text',
    );
    await queryRunner.query(
      'ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "seo_description" text',
    );

    await queryRunner.query(
      "ALTER TABLE \"product_sku\" ADD COLUMN IF NOT EXISTS \"availability\" jsonb NOT NULL DEFAULT '{}'::jsonb",
    );

    await queryRunner.query(
      'ALTER TABLE "product" DROP COLUMN IF EXISTS "availability_json"',
    );
    await queryRunner.query(
      'ALTER TABLE "product" DROP COLUMN IF EXISTS "images_json"',
    );

    await queryRunner.query('DROP TABLE IF EXISTS "product_translation"');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
    );

    await queryRunner.query(
      "CREATE TABLE IF NOT EXISTS \"product_translation\" (\"id\" uuid DEFAULT gen_random_uuid() NOT NULL, \"product_id\" uuid NOT NULL, \"locale\" text NOT NULL, \"title\" text NOT NULL, \"description\" text, \"meta_json\" jsonb NOT NULL DEFAULT '{}'::jsonb, \"created_at\" timestamptz NOT NULL DEFAULT now(), \"updated_at\" timestamptz NOT NULL DEFAULT now(), CONSTRAINT \"PK_product_translation_id\" PRIMARY KEY (\"id\"), CONSTRAINT \"uq_product_locale\" UNIQUE (\"product_id\", \"locale\"))",
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_product_translation_locale" ON "product_translation" ("locale")',
    );
    await queryRunner.query(
      'DO $$ BEGIN ALTER TABLE "product_translation" ADD CONSTRAINT "FK_product_translation_product" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    );

    await queryRunner.query(
      "ALTER TABLE \"product\" ADD COLUMN IF NOT EXISTS \"availability_json\" jsonb NOT NULL DEFAULT '{}'::jsonb",
    );
    await queryRunner.query(
      "ALTER TABLE \"product\" ADD COLUMN IF NOT EXISTS \"images_json\" jsonb NOT NULL DEFAULT '[]'::jsonb",
    );

    await queryRunner.query(
      'ALTER TABLE "product_sku" DROP COLUMN IF EXISTS "availability"',
    );

    await queryRunner.query('ALTER TABLE "product" DROP COLUMN IF EXISTS "seo_description"');
    await queryRunner.query('ALTER TABLE "product" DROP COLUMN IF EXISTS "seo_title"');
  }
}
