import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pricebook Module Migration
 * Creates: pricebook, pricebook_revision, pricebook_assignment, order_pricing_snapshot
 *
 * Single-tenant (SYSTEM_TENANT_ID placeholder) for now, multi-tenant ready.
 */
export class CreatePricebookModule202601221769040000000 implements MigrationInterface {
  name = 'CreatePricebookModule202601221769040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create pricebook table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricebook" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        "code" text NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Unique constraint: code per tenant
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_pricebook_tenant_code"
        ON "pricebook"("tenant_id", "code");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pricebook_active"
        ON "pricebook"("is_active");
    `);

    // 2. Create pricebook_revision table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricebook_revision" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        "pricebook_id" uuid NOT NULL REFERENCES "pricebook"("id") ON DELETE CASCADE,
        "revision_number" int NOT NULL,
        "status" text NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'DEPRECATED')),
        "effective_from" timestamptz,
        "effective_to" timestamptz,
        "currency_code" char(3) NOT NULL,
        "config_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "published_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_pbr_effective_dates"
          CHECK ("effective_to" IS NULL OR "effective_from" IS NULL OR "effective_from" < "effective_to")
      );
    `);

    // Unique: pricebook + revision_number
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_pbr_pricebook_revnum"
        ON "pricebook_revision"("pricebook_id", "revision_number");
    `);

    // Lookup index for effective revision selection
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pbr_effective_lookup"
        ON "pricebook_revision"("pricebook_id", "status", "currency_code", "effective_from", "effective_to");
    `);

    // GIN index for config_snapshot queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pbr_config_gin"
        ON "pricebook_revision" USING GIN ("config_snapshot");
    `);

    // 3. Create pricebook_assignment table (routing)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricebook_assignment" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        "pricebook_id" uuid NOT NULL REFERENCES "pricebook"("id") ON DELETE CASCADE,
        "channel_id" uuid REFERENCES "channel"("id") ON DELETE SET NULL,
        "customer_group_id" uuid REFERENCES "customer_group"("id") ON DELETE SET NULL,
        "country_code" char(2),
        "sales_channel_id" uuid REFERENCES "sales_channel"("id") ON DELETE SET NULL,
        "merchant_id" uuid,
        "priority" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "conditions_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Index for routing lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pba_active_priority"
        ON "pricebook_assignment"("tenant_id", "is_active", "priority" DESC);
    `);

    // Enforce exactly one active default assignment per tenant (single-channel posture)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_pba_default_active"
        ON "pricebook_assignment"("tenant_id")
        WHERE "is_active" = true
          AND "channel_id" IS NULL
          AND "customer_group_id" IS NULL
          AND "country_code" IS NULL
          AND "sales_channel_id" IS NULL
          AND "merchant_id" IS NULL;
    `);

    // 4. Create order_pricing_snapshot table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "order_pricing_snapshot" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
        "order_id" uuid NOT NULL REFERENCES "order"("id") ON DELETE CASCADE,
        "pricebook_revision_id" uuid NOT NULL REFERENCES "pricebook_revision"("id") ON DELETE RESTRICT,
        "currency_code" char(3) NOT NULL,
        "pricing_engine_version" text NOT NULL DEFAULT '1.0.0',
        "locked_at" timestamptz,
        "runtime_context" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Unique: one snapshot per order
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ops_order"
        ON "order_pricing_snapshot"("order_id");
    `);

    // Index for revision lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ops_revision"
        ON "order_pricing_snapshot"("pricebook_revision_id");
    `);

    // Index for locked/unlocked queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ops_locked"
        ON "order_pricing_snapshot"("locked_at");
    `);

    // 5. Create junction table for pricebook ↔ customer_group (many-to-many)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricebook_customer_group" (
        "pricebook_id" uuid NOT NULL REFERENCES "pricebook"("id") ON DELETE CASCADE,
        "customer_group_id" uuid NOT NULL REFERENCES "customer_group"("id") ON DELETE CASCADE,
        PRIMARY KEY ("pricebook_id", "customer_group_id")
      );
    `);

    // 6. Create junction table for pricebook ↔ channel (many-to-many)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricebook_channel" (
        "pricebook_id" uuid NOT NULL REFERENCES "pricebook"("id") ON DELETE CASCADE,
        "channel_id" uuid NOT NULL REFERENCES "channel"("id") ON DELETE CASCADE,
        PRIMARY KEY ("pricebook_id", "channel_id")
      );
    `);

    // 7. Create junction table for pricebook ↔ sales_channel (many-to-many)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricebook_sales_channel" (
        "pricebook_id" uuid NOT NULL REFERENCES "pricebook"("id") ON DELETE CASCADE,
        "sales_channel_id" uuid NOT NULL REFERENCES "sales_channel"("id") ON DELETE CASCADE,
        PRIMARY KEY ("pricebook_id", "sales_channel_id")
      );
    `);

    // 8. Create junction table for pricebook ↔ country (many-to-many via country_code)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricebook_country" (
        "pricebook_id" uuid NOT NULL REFERENCES "pricebook"("id") ON DELETE CASCADE,
        "country_code" char(2) NOT NULL,
        PRIMARY KEY ("pricebook_id", "country_code")
      );
    `);

    // 9. Create junction table for pricebook_revision ↔ price_list (config can reference multiple price lists)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricebook_revision_price_list" (
        "pricebook_revision_id" uuid NOT NULL REFERENCES "pricebook_revision"("id") ON DELETE CASCADE,
        "price_list_id" uuid NOT NULL REFERENCES "price_list"("id") ON DELETE CASCADE,
        "purpose" text NOT NULL DEFAULT 'CATALOG',
        PRIMARY KEY ("pricebook_revision_id", "price_list_id")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pricebook_revision_price_list" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricebook_country" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricebook_sales_channel" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricebook_channel" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricebook_customer_group" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "order_pricing_snapshot" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricebook_assignment" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricebook_revision" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricebook" CASCADE`);
  }
}
