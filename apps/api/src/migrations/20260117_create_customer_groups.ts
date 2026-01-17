import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomerGroups20260117_1769000000000
  implements MigrationInterface
{
  name = 'CreateCustomerGroups20260117_1769000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "customer_group" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "code" text NOT NULL,
      "name" text NOT NULL,
      "description" text NULL,
      "group_type" text NOT NULL DEFAULT 'retail',
      "status" text NOT NULL DEFAULT 'active',
      "priority" int NOT NULL DEFAULT 0,
      "is_stackable" boolean NOT NULL DEFAULT false,
      "valid_from" timestamptz NULL,
      "valid_to" timestamptz NULL,
      "features_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "eligibility_rules_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "price_policy_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "pk_customer_group" PRIMARY KEY ("id"),
      CONSTRAINT "uq_customer_group_code" UNIQUE ("code")
    )`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_customer_group_status_priority" ON "customer_group" ("status", "priority")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "customer_group_member" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "group_id" uuid NOT NULL,
      "member_type" text NOT NULL,
      "member_id" uuid NOT NULL,
      "valid_from" timestamptz NULL,
      "valid_to" timestamptz NULL,
      "meta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "pk_customer_group_member" PRIMARY KEY ("id"),
      CONSTRAINT "fk_customer_group_member_group" FOREIGN KEY ("group_id") REFERENCES "customer_group"("id") ON DELETE CASCADE
    )`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_group_member_unique" ON "customer_group_member" ("group_id", "member_type", "member_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_group_member_lookup" ON "customer_group_member" ("member_type", "member_id")`,
    );

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "customer_group_entitlement" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "group_id" uuid NOT NULL,
      "key" text NOT NULL,
      "is_enabled" boolean NOT NULL DEFAULT true,
      "params_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "pk_customer_group_entitlement" PRIMARY KEY ("id"),
      CONSTRAINT "fk_customer_group_entitlement_group" FOREIGN KEY ("group_id") REFERENCES "customer_group"("id") ON DELETE CASCADE
    )`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_group_entitlement" ON "customer_group_entitlement" ("group_id", "key")`,
    );

    await queryRunner.query(
      `ALTER TABLE "customer_profiles" DROP CONSTRAINT IF EXISTS "fk_customer_profiles_tier"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_profiles_tier_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_customer_profiles_tier_override"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_profiles" DROP COLUMN IF EXISTS "tier_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_profiles" DROP COLUMN IF EXISTS "tier_override_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_profiles" DROP COLUMN IF EXISTS "tier_resolved_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_profiles" DROP COLUMN IF EXISTS "tier_resolved_at"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customer_tier_rule_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_tier_rule"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customer_tier_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_tier"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_group_entitlement"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_group_entitlement"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_group_member_lookup"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_group_member_unique"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_group_member"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customer_group_status_priority"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_group"`);
  }
}
