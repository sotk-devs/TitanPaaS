import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateProjectVolumesTable1730600000000 implements MigrationInterface {
  name = 'CreateProjectVolumesTable1730600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'project_volumes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'volume_name',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'mount_path',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'read_only',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'size',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'project_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Foreign Key project_id -> projects(id)
    await queryRunner.createForeignKey(
      'project_volumes',
      new TableForeignKey({
        name: 'FK_project_volumes_project_id',
        columnNames: ['project_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'projects',
        onDelete: 'CASCADE',
      }),
    );

    // Index on project_id
    await queryRunner.createIndex(
      'project_volumes',
      new TableIndex({
        name: 'IDX_project_volumes_project_id',
        columnNames: ['project_id'],
      }),
    );

    // Unique index on (project_id, mount_path)
    await queryRunner.createIndex(
      'project_volumes',
      new TableIndex({
        name: 'IDX_project_volumes_project_mount_path_unique',
        columnNames: ['project_id', 'mount_path'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'project_volumes',
      'IDX_project_volumes_project_mount_path_unique',
    );
    await queryRunner.dropIndex(
      'project_volumes',
      'IDX_project_volumes_project_id',
    );
    await queryRunner.dropForeignKey(
      'project_volumes',
      'FK_project_volumes_project_id',
    );
    await queryRunner.dropTable('project_volumes');
  }
}
