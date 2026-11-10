import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateProjectDatabasesTable1730700000000 implements MigrationInterface {
  name = 'CreateProjectDatabasesTable1730700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'project_databases',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'project_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'version',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'PROVISIONING'",
            isNullable: false,
          },
          {
            name: 'container_name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'container_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'volume_name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'port',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'database_name',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'username',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'password',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'connection_url',
            type: 'varchar',
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

    await queryRunner.createForeignKey(
      'project_databases',
      new TableForeignKey({
        name: 'FK_PROJECT_DATABASES_PROJECT',
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'project_databases',
      new TableIndex({
        name: 'IDX_PROJECT_DATABASES_PROJECT_ID',
        columnNames: ['project_id'],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'project_databases',
      new TableUnique({
        name: 'UQ_PROJECT_DATABASES_PROJECT_NAME',
        columnNames: ['project_id', 'name'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropUniqueConstraint(
      'project_databases',
      'UQ_PROJECT_DATABASES_PROJECT_NAME',
    );
    await queryRunner.dropIndex(
      'project_databases',
      'IDX_PROJECT_DATABASES_PROJECT_ID',
    );
    await queryRunner.dropForeignKey(
      'project_databases',
      'FK_PROJECT_DATABASES_PROJECT',
    );
    await queryRunner.dropTable('project_databases');
  }
}
