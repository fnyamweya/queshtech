import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductImages20260117160000 implements MigrationInterface {
  name = 'AddProductImages20260117160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(
      'CREATE TABLE IF NOT EXISTS "product_image" ("id" uuid DEFAULT gen_random_uuid() NOT NULL, "product_id" uuid NOT NULL, "sku_id" uuid, "url" text NOT NULL, "alt" text, "is_primary" boolean NOT NULL DEFAULT false, "sort_order" int NOT NULL DEFAULT 0, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "PK_product_image_id" PRIMARY KEY ("id"))',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_product_image_product" ON "product_image" ("product_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_product_image_sku" ON "product_image" ("sku_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_product_image_primary" ON "product_image" ("product_id", "is_primary")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_image_primary" ON "product_image" ("product_id") WHERE is_primary',
    );

    await queryRunner.query(
      'DO $$ BEGIN ALTER TABLE "product_image" ADD CONSTRAINT "FK_product_image_product" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    );
    await queryRunner.query(
      'DO $$ BEGIN ALTER TABLE "product_image" ADD CONSTRAINT "FK_product_image_sku" FOREIGN KEY ("sku_id") REFERENCES "product_sku"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    );

    await queryRunner.query(
      "DO $$\n" +
        "BEGIN\n" +
        "  IF EXISTS (\n" +
        "    SELECT 1\n" +
        "    FROM information_schema.columns\n" +
        "    WHERE table_name = 'product_sku' AND column_name = 'images_json'\n" +
        "  ) THEN\n" +
        "    EXECUTE $q$\n" +
        "      INSERT INTO \"product_image\" (\"product_id\", \"sku_id\", \"url\", \"alt\", \"is_primary\", \"sort_order\", \"created_at\", \"updated_at\")\n" +
        "      SELECT ps.\"product_id\", ps.\"id\", img.url, NULL, false, (img.idx - 1), now(), now()\n" +
        "      FROM \"product_sku\" ps\n" +
        "      JOIN LATERAL jsonb_array_elements_text(ps.\"images_json\") WITH ORDINALITY AS img(url, idx) ON true\n" +
        "      WHERE ps.\"images_json\" IS NOT NULL AND jsonb_array_length(ps.\"images_json\") > 0\n" +
        "    $q$;\n" +
        "  END IF;\n" +
        "END $$;",
    );

    await queryRunner.query(
      'WITH ranked AS (\n' +
        '  SELECT pi."id",\n' +
        '         ROW_NUMBER() OVER (\n' +
        '           PARTITION BY pi."product_id"\n' +
        '           ORDER BY (ps."is_default" IS TRUE) DESC, pi."sort_order" ASC, pi."created_at" ASC\n' +
        '         ) AS rn\n' +
        '  FROM "product_image" pi\n' +
        '  LEFT JOIN "product_sku" ps ON ps."id" = pi."sku_id"\n' +
        ')\n' +
        'UPDATE "product_image" pi\n' +
        'SET "is_primary" = true\n' +
        'FROM ranked r\n' +
        'WHERE pi."id" = r."id" AND r.rn = 1',
    );

    await queryRunner.query(
      'ALTER TABLE "product_sku" DROP COLUMN IF EXISTS "images_json"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "product_sku" ADD COLUMN IF NOT EXISTS "images_json" jsonb NOT NULL DEFAULT "\"[]\""::jsonb',
    );

    await queryRunner.query(
      'UPDATE "product_sku" ps SET "images_json" = COALESCE((\n' +
        '  SELECT jsonb_agg(pi."url" ORDER BY pi."sort_order")\n' +
        '  FROM "product_image" pi\n' +
        '  WHERE pi."sku_id" = ps."id"\n' +
        '), "\"[]\""::jsonb)',
    );

    await queryRunner.query(
      'ALTER TABLE "product_image" DROP CONSTRAINT IF EXISTS "FK_product_image_sku"',
    );
    await queryRunner.query(
      'ALTER TABLE "product_image" DROP CONSTRAINT IF EXISTS "FK_product_image_product"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "uq_product_image_primary"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_product_image_primary"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_product_image_sku"');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_product_image_product"');
    await queryRunner.query('DROP TABLE IF EXISTS "product_image"');
  }
}
