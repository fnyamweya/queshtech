import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixProductShortDescriptionColumn20260121171500
  implements MigrationInterface
{
  name = 'FixProductShortDescriptionColumn20260121171500';

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
