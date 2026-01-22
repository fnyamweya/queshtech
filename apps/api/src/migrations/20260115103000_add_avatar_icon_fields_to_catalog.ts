import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarIconFieldsToCatalog20260115103000
  implements MigrationInterface
{
  name = 'AddAvatarIconFieldsToCatalog20260115103000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "avatar_url" text',
    );

    await queryRunner.query('ALTER TABLE "taxonomy" ADD COLUMN IF NOT EXISTS "icon" text');
    await queryRunner.query(
      'ALTER TABLE "taxonomy" ADD COLUMN IF NOT EXISTS "avatar_url" text',
    );

    await queryRunner.query('ALTER TABLE "brand" ADD COLUMN IF NOT EXISTS "icon" text');
    await queryRunner.query(
      'ALTER TABLE "brand" ADD COLUMN IF NOT EXISTS "avatar_url" text',
    );

    await queryRunner.query(
      'ALTER TABLE "collection" ADD COLUMN IF NOT EXISTS "icon" text',
    );
    await queryRunner.query(
      'ALTER TABLE "collection" ADD COLUMN IF NOT EXISTS "avatar_url" text',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN IF EXISTS "avatar_url"');
    await queryRunner.query('ALTER TABLE "collection" DROP COLUMN IF EXISTS "icon"');

    await queryRunner.query('ALTER TABLE "brand" DROP COLUMN IF EXISTS "avatar_url"');
    await queryRunner.query('ALTER TABLE "brand" DROP COLUMN IF EXISTS "icon"');

    await queryRunner.query('ALTER TABLE "taxonomy" DROP COLUMN IF EXISTS "avatar_url"');
    await queryRunner.query('ALTER TABLE "taxonomy" DROP COLUMN IF EXISTS "icon"');

    await queryRunner.query('ALTER TABLE "category" DROP COLUMN IF EXISTS "avatar_url"');
  }
}
