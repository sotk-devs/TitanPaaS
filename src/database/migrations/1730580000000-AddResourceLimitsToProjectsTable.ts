import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddResourceLimitsToProjectsTable1730580000000 implements MigrationInterface {
  name = 'AddResourceLimitsToProjectsTable1730580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('projects', [
      new TableColumn({
        name: 'cpu_limit',
        type: 'double precision',
        isNullable: true,
      }),
      new TableColumn({
        name: 'memory_limit',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'memory_swap',
        type: 'varchar',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('projects', [
      'cpu_limit',
      'memory_limit',
      'memory_swap',
    ]);
  }
}
