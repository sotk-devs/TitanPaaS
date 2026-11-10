import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddHttpHealthcheckToProjects1730580000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('projects', [
      new TableColumn({
        name: 'healthcheck_path',
        type: 'varchar',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'healthcheck_expected_status',
        type: 'int',
        isNullable: false,
        default: 200,
      }),
      new TableColumn({
        name: 'healthcheck_timeout',
        type: 'int',
        isNullable: false,
        default: 5,
      }),
      new TableColumn({
        name: 'healthcheck_retries',
        type: 'int',
        isNullable: false,
        default: 3,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('projects', 'healthcheck_retries');
    await queryRunner.dropColumn('projects', 'healthcheck_timeout');
    await queryRunner.dropColumn('projects', 'healthcheck_expected_status');
    await queryRunner.dropColumn('projects', 'healthcheck_path');
  }
}
