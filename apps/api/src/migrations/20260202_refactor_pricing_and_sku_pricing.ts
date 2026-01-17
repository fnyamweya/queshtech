import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorPricingAndSkuPricing20260202_1770000000000
  implements MigrationInterface
{
  name = 'RefactorPricingAndSkuPricing20260202_1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_sku_pricing" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "product_sku_id" uuid NOT NULL REFERENCES "product_sku"("id") ON DELETE CASCADE,
        "price_list_id" uuid NOT NULL REFERENCES "price_list"("id") ON DELETE CASCADE,
        "selector_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "currency_code" char(3),
        "unit_amount" bigint NOT NULL,
        "compare_at_amount" bigint,
        "min_quantity" int NOT NULL DEFAULT 1,
        "max_quantity" int,
        "valid_from" timestamptz,
        "valid_to" timestamptz,
        "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_sku_pricing_lookup" ON "product_sku_pricing" ("price_list_id", "product_sku_id", "min_quantity")',
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='price_list'
        ) THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='price_list' AND column_name='type'
          ) THEN
            ALTER TABLE "price_list" ADD COLUMN "type" text NOT NULL DEFAULT 'BASE';
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='price_list' AND column_name='valid_from'
          ) THEN
            ALTER TABLE "price_list" ADD COLUMN "valid_from" timestamptz;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='price_list' AND column_name='valid_to'
          ) THEN
            ALTER TABLE "price_list" ADD COLUMN "valid_to" timestamptz;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='price_list' AND column_name='meta_json'
          ) THEN
            ALTER TABLE "price_list" ADD COLUMN "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb;
          END IF;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='price_row'
        ) THEN
          INSERT INTO "product_sku_pricing" (
            "price_list_id",
            "product_sku_id",
            "selector_json",
            "currency_code",
            "unit_amount",
            "compare_at_amount",
            "min_quantity",
            "max_quantity",
            "valid_from",
            "valid_to",
            "meta_json",
            "created_at",
            "updated_at"
          )
          SELECT
            pr."price_list_id",
            pr."target_id",
            pr."selector_json",
            pr."currency_code",
            pr."unit_amount",
            pr."compare_at_amount",
            pr."min_quantity",
            pr."max_quantity",
            pr."valid_from",
            pr."valid_to",
            pr."meta_json",
            pr."created_at",
            pr."updated_at"
          FROM "price_row" pr
          WHERE pr."target_type" = 'SKU';
        END IF;
      END $$;
    `);

    await queryRunner.query('DROP TABLE IF EXISTS "price_row" CASCADE');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "price_row" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "price_list_id" uuid NOT NULL REFERENCES "price_list"("id") ON DELETE CASCADE,
        "target_type" text NOT NULL,
        "target_id" uuid NOT NULL,
        "selector_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "currency_code" char(3),
        "unit_amount" bigint NOT NULL,
        "compare_at_amount" bigint,
        "min_quantity" int NOT NULL DEFAULT 1,
        "max_quantity" int,
        "valid_from" timestamptz,
        "valid_to" timestamptz,
        "tiers_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_price_row_lookup" ON "price_row" ("price_list_id", "target_type", "target_id", "min_quantity")',
    );

    await queryRunner.query(`
      INSERT INTO "price_row" (
        "price_list_id",
        "target_type",
        "target_id",
        "selector_json",
        "currency_code",
        "unit_amount",
        "compare_at_amount",
        "min_quantity",
        "max_quantity",
        "valid_from",
        "valid_to",
        "tiers_json",
        "meta_json",
        "created_at",
        "updated_at"
      )
      SELECT
        psp."price_list_id",
        'SKU',
        psp."product_sku_id",
        psp."selector_json",
        psp."currency_code",
        psp."unit_amount",
        psp."compare_at_amount",
        psp."min_quantity",
        psp."max_quantity",
        psp."valid_from",
        psp."valid_to",
        '[]'::jsonb,
        psp."meta_json",
        psp."created_at",
        psp."updated_at"
      FROM "product_sku_pricing" psp;
    `);

    await queryRunner.query('DROP TABLE IF EXISTS "product_sku_pricing" CASCADE');

    await queryRunner.query(
      'ALTER TABLE "price_list" DROP COLUMN IF EXISTS "valid_from"',
    );
    await queryRunner.query(
      'ALTER TABLE "price_list" DROP COLUMN IF EXISTS "valid_to"',
    );
    await queryRunner.query(
      'ALTER TABLE "price_list" DROP COLUMN IF EXISTS "type"',
    );
  }
}