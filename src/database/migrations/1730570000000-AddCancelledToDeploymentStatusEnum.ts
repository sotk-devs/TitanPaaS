import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCancelledToDeploymentStatusEnum1730570000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "deployments_status_enum" ADD VALUE IF NOT EXISTS 'CANCELLED';`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `-- No-op: PostgreSQL enum values cannot be dropped without rebuilding the type`,
    );
  }
}
