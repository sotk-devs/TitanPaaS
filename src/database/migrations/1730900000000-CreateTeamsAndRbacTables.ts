import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreateTeamsAndRbacTables1730900000000 implements MigrationInterface {
  name = 'CreateTeamsAndRbacTables1730900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'teams',
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
            name: 'slug',
            type: 'varchar',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'description',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'owner_id',
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

    await queryRunner.createForeignKey(
      'teams',
      new TableForeignKey({
        name: 'FK_TEAMS_OWNER',
        columnNames: ['owner_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndices('teams', [
      new TableIndex({
        name: 'IDX_TEAMS_SLUG',
        columnNames: ['slug'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_TEAMS_OWNER_ID',
        columnNames: ['owner_id'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'team_members',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'team_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'],
            default: "'VIEWER'",
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
        uniques: [
          new TableUnique({
            name: 'UQ_TEAM_MEMBERS_TEAM_USER',
            columnNames: ['team_id', 'user_id'],
          }),
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys('team_members', [
      new TableForeignKey({
        name: 'FK_TEAM_MEMBERS_TEAM',
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_TEAM_MEMBERS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndices('team_members', [
      new TableIndex({
        name: 'IDX_TEAM_MEMBERS_TEAM_ID',
        columnNames: ['team_id'],
      }),
      new TableIndex({
        name: 'IDX_TEAM_MEMBERS_USER_ID',
        columnNames: ['user_id'],
      }),
    ]);

    await queryRunner.addColumn(
      'projects',
      new TableColumn({
        name: 'team_id',
        type: 'uuid',
        isNullable: true,
        default: null,
      }),
    );

    await queryRunner.createForeignKey(
      'projects',
      new TableForeignKey({
        name: 'FK_PROJECTS_TEAM',
        columnNames: ['team_id'],
        referencedTableName: 'teams',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'projects',
      new TableIndex({
        name: 'IDX_PROJECTS_TEAM_ID',
        columnNames: ['team_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('projects', 'IDX_PROJECTS_TEAM_ID');
    await queryRunner.dropForeignKey('projects', 'FK_PROJECTS_TEAM');
    await queryRunner.dropColumn('projects', 'team_id');

    await queryRunner.dropIndex('team_members', 'IDX_TEAM_MEMBERS_USER_ID');
    await queryRunner.dropIndex('team_members', 'IDX_TEAM_MEMBERS_TEAM_ID');
    await queryRunner.dropForeignKey('team_members', 'FK_TEAM_MEMBERS_USER');
    await queryRunner.dropForeignKey('team_members', 'FK_TEAM_MEMBERS_TEAM');
    await queryRunner.dropTable('team_members');
    await queryRunner.query('DROP TYPE IF EXISTS "team_members_role_enum";');

    await queryRunner.dropIndex('teams', 'IDX_TEAMS_OWNER_ID');
    await queryRunner.dropIndex('teams', 'IDX_TEAMS_SLUG');
    await queryRunner.dropForeignKey('teams', 'FK_TEAMS_OWNER');
    await queryRunner.dropTable('teams');
  }
}
