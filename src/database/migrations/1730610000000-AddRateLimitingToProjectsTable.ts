import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRateLimitingToProjectsTable1730610000000 implements MigrationInterface {
  name = 'AddRateLimitingToProjectsTable1730610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('projects', [
      new TableColumn({
        name: 'rate_limit_enabled',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'rate_limit_average',
        type: 'int',
        isNullable: true,
        default: 100,
      }),
      new TableColumn({
        name: 'rate_limit_burst',
        type: 'int',
        isNullable: true,
        default: 50,
      }),
      new TableColumn({
        name: 'rate_limit_period',
        type: 'varchar',
        isNullable: true,
        default: "'1s'",
      }),
      new TableColumn({
        name: 'max_concurrent_connections',
        type: 'int',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('projects', [
      'rate_limit_enabled',
      'rate_limit_average',
      'rate_limit_burst',
      'rate_limit_period',
      'max_concurrent_connections',
    ]);
  }
}
