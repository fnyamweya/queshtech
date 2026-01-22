import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHomepageFlags20260120121000 implements MigrationInterface {
  name = 'AddHomepageFlags20260120121000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "collection" ADD COLUMN IF NOT EXISTS "is_homepage" boolean NOT NULL DEFAULT false;
      CREATE INDEX IF NOT EXISTS "idx_collection_homepage" ON "collection" ("is_homepage");

      ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "is_homepage" boolean NOT NULL DEFAULT false;
      CREATE INDEX IF NOT EXISTS "idx_category_homepage" ON "category" ("is_homepage");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_category_homepage";
      ALTER TABLE "category" DROP COLUMN IF EXISTS "is_homepage";
      DROP INDEX IF EXISTS "idx_collection_homepage";
      ALTER TABLE "collection" DROP COLUMN IF EXISTS "is_homepage";
    `);
  }
}
