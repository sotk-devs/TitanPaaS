import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateDatabaseBackupsAndSchedulesTables1730800000000 implements MigrationInterface {
  name = 'CreateDatabaseBackupsAndSchedulesTables1730800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Crear tabla database_backups
    await queryRunner.createTable(
      new Table({
        name: 'database_backups',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'database_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'project_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'file_name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'file_size',
            type: 'bigint',
            default: 0,
            isNullable: false,
          },
          {
            name: 'storage_key',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'storage_bucket',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'trigger',
            type: 'varchar',
            default: "'MANUAL'",
            isNullable: false,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp with time zone',
            isNullable: true,
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
      'database_backups',
      new TableForeignKey({
        name: 'FK_DATABASE_BACKUPS_DATABASE',
        columnNames: ['database_id'],
        referencedTableName: 'project_databases',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'database_backups',
      new TableForeignKey({
        name: 'FK_DATABASE_BACKUPS_PROJECT',
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'database_backups',
      new TableIndex({
        name: 'IDX_DATABASE_BACKUPS_DATABASE_ID',
        columnNames: ['database_id'],
      }),
    );

    await queryRunner.createIndex(
      'database_backups',
      new TableIndex({
        name: 'IDX_DATABASE_BACKUPS_PROJECT_ID',
        columnNames: ['project_id'],
      }),
    );

    // 2. Crear tabla backup_schedules
    await queryRunner.createTable(
      new Table({
        name: 'backup_schedules',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'database_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'cron_expression',
            type: 'varchar',
            default: "'0 2 * * *'",
            isNullable: false,
          },
          {
            name: 'retention_days',
            type: 'integer',
            default: 7,
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'last_run_at',
            type: 'timestamp with time zone',
            isNullable: true,
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
      'backup_schedules',
      new TableForeignKey({
        name: 'FK_BACKUP_SCHEDULES_DATABASE',
        columnNames: ['database_id'],
        referencedTableName: 'project_databases',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createUniqueConstraint(
      'backup_schedules',
      new TableUnique({
        name: 'UQ_BACKUP_SCHEDULES_DATABASE_ID',
        columnNames: ['database_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('backup_schedules');
    await queryRunner.dropTable('database_backups');
  }
}
