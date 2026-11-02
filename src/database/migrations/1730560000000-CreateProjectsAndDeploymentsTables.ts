import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateProjectsAndDeploymentsTables1730560000000 implements MigrationInterface {
  name = 'CreateProjectsAndDeploymentsTables1730560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create projects table
    await queryRunner.createTable(
      new Table({
        name: 'projects',
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
            name: 'repository_url',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'repository_name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'branch',
            type: 'varchar',
            default: "'main'",
            isNullable: false,
          },
          {
            name: 'port',
            type: 'int',
            default: 3000,
            isNullable: false,
          },
          {
            name: 'env_variables',
            type: 'jsonb',
            default: "'{}'",
            isNullable: false,
          },
          {
            name: 'user_id',
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

    // Foreign key for projects -> users
    await queryRunner.createForeignKey(
      'projects',
      new TableForeignKey({
        name: 'FK_PROJECTS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Indices for projects
    await queryRunner.createIndices('projects', [
      new TableIndex({
        name: 'IDX_PROJECTS_USER_ID',
        columnNames: ['user_id'],
      }),
      new TableIndex({
        name: 'IDX_PROJECTS_REPOSITORY_NAME',
        columnNames: ['repository_name'],
      }),
    ]);

    // Create deployments table
    await queryRunner.createTable(
      new Table({
        name: 'deployments',
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
            name: 'status',
            type: 'enum',
            enum: [
              'PENDING',
              'QUEUED',
              'BUILDING',
              'DEPLOYING',
              'DEPLOYED',
              'FAILED',
              'STOPPED',
            ],
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'commit_sha',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'commit_message',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'branch',
            type: 'varchar',
            default: "'main'",
            isNullable: false,
          },
          {
            name: 'logs',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'stages',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'container_id',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'finished_at',
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

    // Foreign key for deployments -> projects
    await queryRunner.createForeignKey(
      'deployments',
      new TableForeignKey({
        name: 'FK_DEPLOYMENTS_PROJECT',
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Indices for deployments
    await queryRunner.createIndices('deployments', [
      new TableIndex({
        name: 'IDX_DEPLOYMENTS_PROJECT_ID',
        columnNames: ['project_id'],
      }),
      new TableIndex({
        name: 'IDX_DEPLOYMENTS_STATUS',
        columnNames: ['status'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('deployments', 'FK_DEPLOYMENTS_PROJECT');
    await queryRunner.dropTable('deployments');
    await queryRunner.query('DROP TYPE IF EXISTS "deployments_status_enum";');

    await queryRunner.dropForeignKey('projects', 'FK_PROJECTS_USER');
    await queryRunner.dropTable('projects');
  }
}
