import { MigrationInterface, QueryRunner } from 'typeorm';
import { EncryptionService } from '../../common/encryption/encryption.service.js';

export class EncryptExistingProjectEnvVariables1730600000000 implements MigrationInterface {
  name = 'EncryptExistingProjectEnvVariables1730600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const encryptionService = new EncryptionService();
    const rows = await queryRunner.query(
      'SELECT id, env_variables FROM projects WHERE env_variables IS NOT NULL',
    );

    for (const row of rows) {
      const envVars =
        typeof row.env_variables === 'string'
          ? JSON.parse(row.env_variables)
          : row.env_variables;

      if (envVars && !envVars.__encrypted && Object.keys(envVars).length > 0) {
        const encrypted = encryptionService.encryptJson(envVars);
        await queryRunner.query(
          'UPDATE projects SET env_variables = $1 WHERE id = $2',
          [JSON.stringify(encrypted), row.id],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const encryptionService = new EncryptionService();
    const rows = await queryRunner.query(
      'SELECT id, env_variables FROM projects WHERE env_variables IS NOT NULL',
    );

    for (const row of rows) {
      const envVars =
        typeof row.env_variables === 'string'
          ? JSON.parse(row.env_variables)
          : row.env_variables;

      if (envVars && envVars.__encrypted === true) {
        try {
          const decrypted = encryptionService.decryptJson(envVars);
          await queryRunner.query(
            'UPDATE projects SET env_variables = $1 WHERE id = $2',
            [JSON.stringify(decrypted), row.id],
          );
        } catch {
          // If decryption fails during rollback, keep current data
        }
      }
    }
  }
}
