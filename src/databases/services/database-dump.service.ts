import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { ProjectDatabase } from '../entities/project-database.entity.js';
import { DatabaseType } from '../enums/database-type.enum.js';

export interface DumpResult {
  buffer: Buffer;
  fileName: string;
}

@Injectable()
export class DatabaseDumpService {
  private readonly logger = new Logger(DatabaseDumpService.name);

  async executeDocker(args: string[], stdinData?: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.logger.debug(
        `Ejecutando comando docker con args: ${args.join(' ')}`,
      );
      const child = spawn('docker', args);
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout?.on('data', (chunk) => {
        stdoutChunks.push(Buffer.from(chunk));
      });

      child.stderr?.on('data', (chunk) => {
        stderrChunks.push(Buffer.from(chunk));
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          const stderr = Buffer.concat(stderrChunks).toString('utf-8');
          reject(
            new Error(
              `Proceso docker falló con código ${code}: ${stderr.trim()}`,
            ),
          );
        } else {
          resolve(Buffer.concat(stdoutChunks));
        }
      });

      if (stdinData && child.stdin) {
        child.stdin.write(stdinData);
        child.stdin.end();
      }
    });
  }

  generateFileName(database: ProjectDatabase): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_');
    const ext = database.type === DatabaseType.REDIS ? 'rdb.gz' : 'sql.gz';
    return `backup_${database.name}_${timestamp}.${ext}`;
  }

  async dump(database: ProjectDatabase): Promise<DumpResult> {
    const fileName = this.generateFileName(database);
    let rawBuffer: Buffer;

    this.logger.log(
      `Generando volcado de base de datos ${database.name} (${database.type})...`,
    );

    if (database.type === DatabaseType.POSTGRESQL) {
      const username = database.username || 'postgres';
      const dbName = database.databaseName || 'postgres';
      const args = [
        'exec',
        '-i',
        database.containerName,
        'pg_dump',
        '-U',
        username,
        '-d',
        dbName,
        '--no-owner',
        '--clean',
      ];
      rawBuffer = await this.executeDocker(args);
    } else if (database.type === DatabaseType.MYSQL) {
      const username = database.username || 'root';
      const dbName = database.databaseName || 'mysql';
      const password = database.password;
      const args = [
        'exec',
        '-i',
        database.containerName,
        'mysqldump',
        `-u${username}`,
        `-p${password}`,
        dbName,
      ];
      rawBuffer = await this.executeDocker(args);
    } else if (database.type === DatabaseType.REDIS) {
      // 1. Ejecutar SAVE en Redis
      const saveArgs = [
        'exec',
        database.containerName,
        'redis-cli',
        '-a',
        database.password,
        'SAVE',
      ];
      await this.executeDocker(saveArgs);

      // 2. Extraer el archivo dump.rdb
      const catArgs = ['exec', database.containerName, 'cat', '/data/dump.rdb'];
      rawBuffer = await this.executeDocker(catArgs);
    } else {
      throw new Error(`Motor de base de datos no soportado: ${database.type}`);
    }

    const compressed = gzipSync(rawBuffer);
    this.logger.log(
      `Volcado ${fileName} generado y comprimido (${compressed.length} bytes)`,
    );

    return {
      buffer: compressed,
      fileName,
    };
  }

  async restore(
    database: ProjectDatabase,
    compressedBuffer: Buffer,
  ): Promise<void> {
    this.logger.log(
      `Restaurando base de datos ${database.name} (${database.type})...`,
    );

    const decompressed = gunzipSync(compressedBuffer);

    if (database.type === DatabaseType.POSTGRESQL) {
      const username = database.username || 'postgres';
      const dbName = database.databaseName || 'postgres';
      const args = [
        'exec',
        '-i',
        database.containerName,
        'psql',
        '-U',
        username,
        '-d',
        dbName,
      ];
      await this.executeDocker(args, decompressed);
    } else if (database.type === DatabaseType.MYSQL) {
      const username = database.username || 'root';
      const dbName = database.databaseName || 'mysql';
      const password = database.password;
      const args = [
        'exec',
        '-i',
        database.containerName,
        'mysql',
        `-u${username}`,
        `-p${password}`,
        dbName,
      ];
      await this.executeDocker(args, decompressed);
    } else if (database.type === DatabaseType.REDIS) {
      // Para Redis: escribir dump.rdb hacia el contenedor
      const writeArgs = [
        'exec',
        '-i',
        database.containerName,
        'sh',
        '-c',
        'cat > /data/dump.rdb',
      ];
      await this.executeDocker(writeArgs, decompressed);

      // Reiniciar contenedor para cargar el RDB
      await this.executeDocker(['restart', database.containerName]);
    }

    this.logger.log(
      `Restauración de base de datos ${database.name} completada exitosamente.`,
    );
  }
}
