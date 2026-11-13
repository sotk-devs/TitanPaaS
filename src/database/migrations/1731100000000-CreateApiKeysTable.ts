import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateApiKeysTable1731100000000 implements MigrationInterface {
  name = 'CreateApiKeysTable1731100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'api_keys',
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
            name: 'description',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'key_prefix',
            type: 'varchar',
            length: '24',
            isNullable: false,
          },
          {
            name: 'key_hash',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          {
            name: 'scopes',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'",
          },
          {
            name: 'allowed_project_ids',
            type: 'jsonb',
            isNullable: true,
            default: null,
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_used_at',
            type: 'timestamp with time zone',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_used_ip',
            type: 'varchar',
            isNullable: true,
            default: null,
          },
          {
            name: 'revoked_at',
            type: 'timestamp with time zone',
            isNullable: true,
            default: null,
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

    await queryRunner.createIndex(
      'api_keys',
      new TableIndex({
        name: 'IDX_API_KEYS_KEY_HASH',
        columnNames: ['key_hash'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'api_keys',
      new TableIndex({
        name: 'IDX_API_KEYS_USER_ID',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'api_keys',
      new TableForeignKey({
        name: 'FK_API_KEYS_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('api_keys', 'FK_API_KEYS_USER');
    await queryRunner.dropIndex('api_keys', 'IDX_API_KEYS_USER_ID');
    await queryRunner.dropIndex('api_keys', 'IDX_API_KEYS_KEY_HASH');
    await queryRunner.dropTable('api_keys');
  }
}
