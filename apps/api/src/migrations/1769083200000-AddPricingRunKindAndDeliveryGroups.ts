import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPricingRunKindAndDeliveryGroups1769083200000
  implements MigrationInterface
{
  name = 'AddPricingRunKindAndDeliveryGroups1769083200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // pricing_run.kind
    await queryRunner.query(`
      ALTER TABLE "pricing_run"
      ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'STANDARD'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pricing_run_kind" ON "pricing_run" ("kind")
    `);

    // delivery_group
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "delivery_group" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "warehouse_id" uuid,
        "shipping_address_snapshot_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_delivery_group_order" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_delivery_group_order" ON "delivery_group" ("order_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_delivery_group_warehouse" ON "delivery_group" ("warehouse_id")`,
    );

    // delivery_group_item
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "delivery_group_item" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "delivery_group_id" uuid NOT NULL,
        "order_item_id" uuid NOT NULL,
        "quantity" int NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_delivery_group_item_group" FOREIGN KEY ("delivery_group_id") REFERENCES "delivery_group"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_delivery_group_item_order_item" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_dg_item_group" ON "delivery_group_item" ("delivery_group_id")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_dg_item_group_order_item" ON "delivery_group_item" ("delivery_group_id", "order_item_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_dg_item_group_order_item"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_dg_item_group"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_group_item" CASCADE`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_delivery_group_warehouse"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_delivery_group_order"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "delivery_group" CASCADE`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pricing_run_kind"`);
    await queryRunner.query(`ALTER TABLE "pricing_run" DROP COLUMN IF EXISTS "kind"`);
  }
}
