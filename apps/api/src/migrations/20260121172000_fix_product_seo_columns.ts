import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixProductSeoColumns20260121172000 implements MigrationInterface {
  name = 'FixProductSeoColumns20260121172000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "seo_title" text',
    );
    await queryRunner.query(
      'ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "seo_description" text',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "product" DROP COLUMN IF EXISTS "seo_description"',
    );
    await queryRunner.query(
      'ALTER TABLE "product" DROP COLUMN IF EXISTS "seo_title"',
    );
  }
}
