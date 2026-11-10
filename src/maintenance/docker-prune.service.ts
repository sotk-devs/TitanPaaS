import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import type { DockerPruneDetails } from './interfaces/garbage-collector.interface.js';

@Injectable()
export class DockerPruneService {
  private readonly logger = new Logger(DockerPruneService.name);

  async executeCommand(
    command: string,
    args: string[],
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Ejecutando: ${command} ${args.join(' ')}`);

      const child = spawn(command, args, {
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (exitCode) => {
        if (exitCode !== 0) {
          const errorMessage =
            stderr || stdout || `Process exited with code ${exitCode}`;
          reject(new Error(errorMessage));
        } else {
          resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
        }
      });
    });
  }

  async pruneImages(olderThanHours: number): Promise<DockerPruneDetails> {
    const args = [
      'image',
      'prune',
      '-a',
      '-f',
      '--filter',
      `until=${olderThanHours}h`,
    ];

    try {
      const result = await this.executeCommand('docker', args);
      const deleted = this.extractDeletedItems(result.stdout);
      const spaceReclaimedBytes = this.parseSpaceReclaimed(result.stdout);

      this.logger.log(
        `[DockerPrune] Imagenes purgadas: ${deleted.length}, espacio liberado: ${spaceReclaimedBytes} bytes`,
      );

      return {
        deleted,
        spaceReclaimedBytes,
        raw: result.stdout.trim(),
      };
    } catch (error) {
      this.logger.warn(
        `[DockerPrune] Error al purgar imagenes Docker: ${(error as Error).message}`,
      );
      return {
        deleted: [],
        spaceReclaimedBytes: 0,
        raw: (error as Error).message,
      };
    }
  }

  async pruneContainers(olderThanHours: number): Promise<DockerPruneDetails> {
    const args = [
      'container',
      'prune',
      '-f',
      '--filter',
      `until=${olderThanHours}h`,
    ];

    try {
      const result = await this.executeCommand('docker', args);
      const deleted = this.extractDeletedItems(result.stdout);
      const spaceReclaimedBytes = this.parseSpaceReclaimed(result.stdout);

      this.logger.log(
        `[DockerPrune] Contenedores purgados: ${deleted.length}, espacio liberado: ${spaceReclaimedBytes} bytes`,
      );

      return {
        deleted,
        spaceReclaimedBytes,
        raw: result.stdout.trim(),
      };
    } catch (error) {
      this.logger.warn(
        `[DockerPrune] Error al purgar contenedores detenidos: ${(error as Error).message}`,
      );
      return {
        deleted: [],
        spaceReclaimedBytes: 0,
        raw: (error as Error).message,
      };
    }
  }

  async pruneVolumes(): Promise<DockerPruneDetails> {
    const args = ['volume', 'prune', '-f'];

    try {
      const result = await this.executeCommand('docker', args);
      const deleted = this.extractDeletedItems(result.stdout);
      const spaceReclaimedBytes = this.parseSpaceReclaimed(result.stdout);

      this.logger.log(
        `[DockerPrune] Volumenes purgados: ${deleted.length}, espacio liberado: ${spaceReclaimedBytes} bytes`,
      );

      return {
        deleted,
        spaceReclaimedBytes,
        raw: result.stdout.trim(),
      };
    } catch (error) {
      this.logger.warn(
        `[DockerPrune] Error al purgar volumenes Docker: ${(error as Error).message}`,
      );
      return {
        deleted: [],
        spaceReclaimedBytes: 0,
        raw: (error as Error).message,
      };
    }
  }

  extractDeletedItems(output: string): string[] {
    const lines = output.split('\n');
    const items: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (
        trimmed.startsWith('Deleted ') ||
        trimmed.startsWith('Total reclaimed space')
      ) {
        continue;
      }
      const item = trimmed.replace(/^(deleted|untagged):\s*/i, '').trim();
      if (item && !items.includes(item)) {
        items.push(item);
      }
    }

    return items;
  }

  parseSpaceReclaimed(output: string): number {
    const match = output.match(
      /Total reclaimed space:\s*([0-9.]+)\s*([a-zA-Z]+)/i,
    );
    if (!match) {
      return 0;
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    if (isNaN(value)) {
      return 0;
    }

    switch (unit) {
      case 'B':
        return Math.round(value);
      case 'KB':
      case 'KIB':
        return Math.round(value * 1024);
      case 'MB':
      case 'MIB':
        return Math.round(value * 1024 * 1024);
      case 'GB':
      case 'GIB':
        return Math.round(value * 1024 * 1024 * 1024);
      case 'TB':
      case 'TIB':
        return Math.round(value * 1024 * 1024 * 1024 * 1024);
      default:
        return Math.round(value);
    }
  }
}
