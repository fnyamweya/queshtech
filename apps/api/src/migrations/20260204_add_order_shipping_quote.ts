import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderShippingQuote20260204090000
  implements MigrationInterface
{
  name = 'AddOrderShippingQuote20260204090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_quote_pending" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "shipping_quote_pending"`,
    );
  }
}
