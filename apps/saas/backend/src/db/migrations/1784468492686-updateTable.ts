import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTable1784468492686 implements MigrationInterface {
  name = 'UpdateTable1784468492686';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "widths"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "media" ADD "widths" jsonb NOT NULL DEFAULT '[]'`);
  }
}
