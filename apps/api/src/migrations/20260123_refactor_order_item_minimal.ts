import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorOrderItemMinimal20260123_1769200000000
  implements MigrationInterface
{
  name = 'RefactorOrderItemMinimal20260123_1769200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_item"
      DROP COLUMN IF EXISTS "product_id",
      DROP COLUMN IF EXISTS "product_handle",
      DROP COLUMN IF EXISTS "product_name",
      DROP COLUMN IF EXISTS "sku_title",
      DROP COLUMN IF EXISTS "sku_options_json",
      DROP COLUMN IF EXISTS "attributes_json",
      DROP COLUMN IF EXISTS "price_list_id",
      DROP COLUMN IF EXISTS "unit_price",
      DROP COLUMN IF EXISTS "compare_at_price",
      DROP COLUMN IF EXISTS "base_subtotal",
      DROP COLUMN IF EXISTS "discount_total",
      DROP COLUMN IF EXISTS "fee_total",
      DROP COLUMN IF EXISTS "tax_total",
      DROP COLUMN IF EXISTS "total",
      DROP COLUMN IF EXISTS "fulfillment_status",
      DROP COLUMN IF EXISTS "fulfillment_group",
      DROP COLUMN IF EXISTS "pricing_snapshot_json",
      DROP COLUMN IF EXISTS "meta_json";
    `);

    await queryRunner.query(`ALTER TABLE "order_item"
      ADD COLUMN IF NOT EXISTS "product_sku_id" uuid NOT NULL,
      ADD COLUMN IF NOT EXISTS "sku" text,
      ADD COLUMN IF NOT EXISTS "requires_shipping" boolean NOT NULL DEFAULT true;
    `);

    await queryRunner.query(`DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ck_order_item_quantity_positive'
        ) THEN
          ALTER TABLE "order_item" ADD CONSTRAINT "ck_order_item_quantity_positive" CHECK ("quantity" > 0);
        END IF;
      END
    $$;`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_order_item_order_id" ON "order_item" ("order_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_order_item_product_sku_id" ON "order_item" ("product_sku_id");`,
    );

    await queryRunner.query('DROP TABLE IF EXISTS "order_item_charge" CASCADE;');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "order_item_charge" (
      "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      "order_item_id" uuid NOT NULL,
      "charge_kind" text NOT NULL,
      "code" text,
      "display_name" text NOT NULL,
      "calculation_type" text NOT NULL,
      "rate" numeric(9,6),
      "base_amount" numeric(18,4),
      "quantity_basis" int,
      "amount" numeric(18,4) NOT NULL,
      "is_included_in_price" boolean NOT NULL DEFAULT false,
      "source_type" text,
      "source_reference" text,
      "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "fk_orderitemcharge_orderitem" FOREIGN KEY ("order_item_id") REFERENCES "order_item" ("id") ON DELETE CASCADE
    );`);

    await queryRunner.query('DROP INDEX IF EXISTS "idx_order_item_product_sku_id";');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_order_item_order_id";');
    await queryRunner.query('ALTER TABLE "order_item" DROP CONSTRAINT IF EXISTS "ck_order_item_quantity_positive";');

    await queryRunner.query(`ALTER TABLE "order_item"
      DROP COLUMN IF EXISTS "requires_shipping",
      DROP COLUMN IF EXISTS "sku",
      DROP COLUMN IF EXISTS "product_sku_id";
    `);

    await queryRunner.query(`ALTER TABLE "order_item"
      ADD COLUMN IF NOT EXISTS "product_id" uuid,
      ADD COLUMN IF NOT EXISTS "product_handle" text,
      ADD COLUMN IF NOT EXISTS "product_name" text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS "sku_title" text,
      ADD COLUMN IF NOT EXISTS "sku_options_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS "attributes_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS "price_list_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      ADD COLUMN IF NOT EXISTS "unit_price" numeric(18,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "compare_at_price" numeric(18,4),
      ADD COLUMN IF NOT EXISTS "base_subtotal" numeric(18,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "discount_total" numeric(18,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "fee_total" numeric(18,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_total" numeric(18,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "total" numeric(18,4) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "fulfillment_status" text NOT NULL DEFAULT 'unfulfilled',
      ADD COLUMN IF NOT EXISTS "fulfillment_group" text,
      ADD COLUMN IF NOT EXISTS "pricing_snapshot_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb;
    `);
  }
}
