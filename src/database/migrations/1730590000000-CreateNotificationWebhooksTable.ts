import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateNotificationWebhooksTable1730590000000 implements MigrationInterface {
  name = 'CreateNotificationWebhooksTable1730590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notification_webhooks',
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
            type: 'enum',
            enum: ['DISCORD', 'SLACK', 'WEBHOOK'],
            default: "'WEBHOOK'",
            isNullable: false,
          },
          {
            name: 'url',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'events',
            type: 'jsonb',
            default:
              '\'["DEPLOY_STARTED","DEPLOY_SUCCEEDED","DEPLOY_FAILED"]\'',
            isNullable: false,
          },
          {
            name: 'secret',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
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
      'notification_webhooks',
      new TableForeignKey({
        name: 'FK_NOTIFICATION_WEBHOOKS_PROJECT',
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'notification_webhooks',
      new TableIndex({
        name: 'IDX_NOTIFICATION_WEBHOOKS_PROJECT_ID',
        columnNames: ['project_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'notification_webhooks',
      'IDX_NOTIFICATION_WEBHOOKS_PROJECT_ID',
    );
    await queryRunner.dropForeignKey(
      'notification_webhooks',
      'FK_NOTIFICATION_WEBHOOKS_PROJECT',
    );
    await queryRunner.dropTable('notification_webhooks');
    await queryRunner.query(
      'DROP TYPE IF EXISTS "notification_webhooks_type_enum";',
    );
  }
}
