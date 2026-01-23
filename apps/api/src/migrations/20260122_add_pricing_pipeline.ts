import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPricingPipeline20260122_1769071930207
  implements MigrationInterface
{
  name = 'AddPricingPipeline20260122_1769071930207';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricing_run" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "snapshot_id" uuid NOT NULL,
        "idempotency_key" text NOT NULL,
        "status" text NOT NULL DEFAULT 'STARTED' CHECK ("status" IN ('STARTED','SUCCEEDED','FAILED')),
        "engine_version" text NOT NULL,
        "error" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "finished_at" timestamptz,
        CONSTRAINT "fk_pricing_run_order" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pricing_run_snapshot" FOREIGN KEY ("snapshot_id") REFERENCES "order_pricing_snapshot"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_pricing_run_order_idempotency" ON "pricing_run" ("order_id", "idempotency_key");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pricing_run_snapshot" ON "pricing_run" ("snapshot_id", "status", "created_at" DESC);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "charge_component" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "order_item_id" uuid,
        "snapshot_id" uuid NOT NULL,
        "pricing_run_id" uuid NOT NULL,
        "scope" text NOT NULL CHECK ("scope" IN ('ORDER','ITEM')),
        "charge_type" text NOT NULL,
        "currency_code" char(3) NOT NULL,
        "code" text,
        "display_name" text,
        "amount" numeric(18,4) NOT NULL,
        "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_charge_component_order" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_charge_component_item" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_charge_component_snapshot" FOREIGN KEY ("snapshot_id") REFERENCES "order_pricing_snapshot"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_charge_component_run" FOREIGN KEY ("pricing_run_id") REFERENCES "pricing_run"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_charge_component_snapshot_run" ON "charge_component" ("snapshot_id", "pricing_run_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_charge_component_order" ON "charge_component" ("order_id", "created_at" DESC);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "charge_allocation" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "order_item_id" uuid,
        "snapshot_id" uuid NOT NULL,
        "pricing_run_id" uuid NOT NULL,
        "charge_component_id" uuid NOT NULL,
        "amount" numeric(18,4) NOT NULL,
        "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_charge_allocation_order" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_charge_allocation_item" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_charge_allocation_snapshot" FOREIGN KEY ("snapshot_id") REFERENCES "order_pricing_snapshot"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_charge_allocation_run" FOREIGN KEY ("pricing_run_id") REFERENCES "pricing_run"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_charge_allocation_component" FOREIGN KEY ("charge_component_id") REFERENCES "charge_component"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_charge_allocation_component" ON "charge_allocation" ("charge_component_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_charge_allocation_snapshot_run" ON "charge_allocation" ("snapshot_id", "pricing_run_id");`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricing_applied_rule" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "order_item_id" uuid,
        "snapshot_id" uuid NOT NULL,
        "pricing_run_id" uuid NOT NULL,
        "rule_type" text NOT NULL,
        "rule_id" text,
        "rule_version" text,
        "decision" text NOT NULL CHECK ("decision" IN ('APPLIED','SKIPPED','REJECTED')),
        "trace" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_pricing_rule_order" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pricing_rule_item" FOREIGN KEY ("order_item_id") REFERENCES "order_item"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_pricing_rule_snapshot" FOREIGN KEY ("snapshot_id") REFERENCES "order_pricing_snapshot"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_pricing_rule_run" FOREIGN KEY ("pricing_run_id") REFERENCES "pricing_run"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pricing_rule_snapshot_run" ON "pricing_applied_rule" ("snapshot_id", "pricing_run_id");`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pricing_rule_order" ON "pricing_applied_rule" ("order_id", "created_at" DESC);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pricing_rule_order";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pricing_rule_snapshot_run";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricing_applied_rule";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_charge_allocation_snapshot_run";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_charge_allocation_component";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "charge_allocation";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_charge_component_order";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_charge_component_snapshot_run";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "charge_component";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pricing_run_snapshot";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_pricing_run_order_idempotency";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricing_run";`);
  }
}
