import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCustomDomainsTable1730580000000 implements MigrationInterface {
  name = 'CreateCustomDomainsTable1730580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear tipo ENUM si no existe
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'custom_domain_status_enum') THEN
          CREATE TYPE custom_domain_status_enum AS ENUM ('PENDING', 'VERIFIED', 'FAILED');
        END IF;
      END$$;
    `);

    // Crear tabla custom_domains
    await queryRunner.createTable(
      new Table({
        name: 'custom_domains',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'domain',
            type: 'varchar',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'project_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'custom_domain_status_enum',
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: 'verification_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'verified_at',
            type: 'timestamp with time zone',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Foreign key hacia projects
    await queryRunner.createForeignKey(
      'custom_domains',
      new TableForeignKey({
        name: 'FK_custom_domains_project_id',
        columnNames: ['project_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'projects',
        onDelete: 'CASCADE',
      }),
    );

    // Índices
    await queryRunner.createIndex(
      'custom_domains',
      new TableIndex({
        name: 'IDX_custom_domains_domain',
        columnNames: ['domain'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'custom_domains',
      new TableIndex({
        name: 'IDX_custom_domains_project_id',
        columnNames: ['project_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'custom_domains',
      'FK_custom_domains_project_id',
    );
    await queryRunner.dropIndex(
      'custom_domains',
      'IDX_custom_domains_project_id',
    );
    await queryRunner.dropIndex('custom_domains', 'IDX_custom_domains_domain');
    await queryRunner.dropTable('custom_domains');
    await queryRunner.query('DROP TYPE IF EXISTS custom_domain_status_enum;');
  }
}
