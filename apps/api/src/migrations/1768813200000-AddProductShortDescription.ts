import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductShortDescription1768813200000
  implements MigrationInterface
{
  name = 'AddProductShortDescription1768813200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "short_description" text',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "product" DROP COLUMN IF EXISTS "short_description"',
    );
  }
}
