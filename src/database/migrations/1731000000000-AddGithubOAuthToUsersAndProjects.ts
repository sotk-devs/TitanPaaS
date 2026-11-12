import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddGithubOAuthToUsersAndProjects1731000000000 implements MigrationInterface {
  name = 'AddGithubOAuthToUsersAndProjects1731000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;',
    );

    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'github_id',
        type: 'varchar',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'github_username',
        type: 'varchar',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'avatar_url',
        type: 'varchar',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'github_access_token',
        type: 'text',
        isNullable: true,
        default: null,
      }),
    ]);

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_GITHUB_ID',
        columnNames: ['github_id'],
        isUnique: true,
      }),
    );

    await queryRunner.addColumns('projects', [
      new TableColumn({
        name: 'github_repo_id',
        type: 'varchar',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'is_private',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    ]);

    await queryRunner.createIndex(
      'projects',
      new TableIndex({
        name: 'IDX_PROJECTS_GITHUB_REPO_ID',
        columnNames: ['github_repo_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('projects', 'IDX_PROJECTS_GITHUB_REPO_ID');
    await queryRunner.dropColumn('projects', 'is_private');
    await queryRunner.dropColumn('projects', 'github_repo_id');

    await queryRunner.dropIndex('users', 'IDX_USERS_GITHUB_ID');
    await queryRunner.dropColumn('users', 'github_access_token');
    await queryRunner.dropColumn('users', 'avatar_url');
    await queryRunner.dropColumn('users', 'github_username');
    await queryRunner.dropColumn('users', 'github_id');

    await queryRunner.query(
      'UPDATE "users" SET "password" = \'\' WHERE "password" IS NULL;',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL;',
    );
  }
}
