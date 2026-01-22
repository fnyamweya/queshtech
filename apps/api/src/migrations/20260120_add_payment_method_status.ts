import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodStatus20260120090000 implements MigrationInterface {
  name = 'AddPaymentMethodStatus20260120090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payment_method"
      ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
    `);

    await queryRunner.query(`
      UPDATE "payment_method"
      SET "status" = CASE
        WHEN "is_active" = TRUE THEN 'active'
        ELSE 'inactive'
      END
      WHERE "status" IS NULL OR "status" = '';
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "idx_payment_method_status" ON "payment_method" ("status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "idx_payment_method_status"');
    await queryRunner.query('ALTER TABLE "payment_method" DROP COLUMN IF EXISTS "status"');
  }
}
