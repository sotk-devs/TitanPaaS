import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddClusterSupportToProjects1730900000000 implements MigrationInterface {
  name = 'AddClusterSupportToProjects1730900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('projects', [
      new TableColumn({
        name: 'is_cluster_enabled',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
      new TableColumn({
        name: 'cluster_replicas',
        type: 'integer',
        default: 1,
        isNullable: false,
      }),
      new TableColumn({
        name: 'cluster_placement',
        type: 'varchar',
        isNullable: true,
        default: null,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('projects', [
      'is_cluster_enabled',
      'cluster_replicas',
      'cluster_placement',
    ]);
  }
}
