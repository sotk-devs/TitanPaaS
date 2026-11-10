import { Injectable, Logger } from '@nestjs/common';
import { readdir, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { WorkspaceCleanResult } from './interfaces/garbage-collector.interface.js';

export interface DirectoryEntry {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

export interface FileStats {
  mtimeMs: number;
  size: number;
}

@Injectable()
export class WorkspaceCleanerService {
  private readonly logger = new Logger(WorkspaceCleanerService.name);

  getBaseBuildsPath(): string {
    return join(tmpdir(), 'titan-paas', 'builds');
  }

  async readDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    return (await readdir(dirPath, {
      withFileTypes: true,
    })) as DirectoryEntry[];
  }

  async getFileStats(filePath: string): Promise<FileStats> {
    const stats = await stat(filePath);
    return {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
    };
  }

  async removePath(targetPath: string): Promise<void> {
    await rm(targetPath, { recursive: true, force: true });
  }

  async cleanStaleWorkspaces(
    olderThanHours: number,
  ): Promise<WorkspaceCleanResult> {
    const basePath = this.getBaseBuildsPath();
    const workspacesDeleted: string[] = [];
    let spaceReclaimedBytes = 0;
    const cutoffTimestamp = Date.now() - olderThanHours * 60 * 60 * 1000;

    try {
      const repoFolders = await this.readDirectory(basePath);

      for (const repoFolder of repoFolders) {
        if (!repoFolder.isDirectory()) continue;
        const repoPath = join(basePath, repoFolder.name);

        try {
          const buildFolders = await this.readDirectory(repoPath);

          for (const buildFolder of buildFolders) {
            if (!buildFolder.isDirectory()) continue;
            const buildPath = join(repoPath, buildFolder.name);

            try {
              const stats = await this.getFileStats(buildPath);
              if (stats.mtimeMs < cutoffTimestamp) {
                const size = await this.calculateDirectorySize(buildPath);
                await this.removePath(buildPath);
                workspacesDeleted.push(
                  `${repoFolder.name}/${buildFolder.name}`,
                );
                spaceReclaimedBytes += size;
              }
            } catch (err) {
              this.logger.debug(
                `No se pudo procesar espacio de compilacion ${buildPath}: ${(err as Error).message}`,
              );
            }
          }

          // Si el directorio del repositorio queda vacio, limpiarlo
          const remaining = await this.readDirectory(repoPath);
          if (remaining.length === 0) {
            await this.removePath(repoPath);
          }
        } catch (err) {
          this.logger.debug(
            `Error escaneando subdirectorio de repo ${repoPath}: ${(err as Error).message}`,
          );
        }
      }

      this.logger.log(
        `[WorkspaceCleaner] Espacios temporales purgados: ${workspacesDeleted.length}, espacio liberado: ${spaceReclaimedBytes} bytes`,
      );
    } catch (error) {
      this.logger.debug(
        `Directorio base de compilacion ${basePath} no existe o no pudo ser leido: ${(error as Error).message}`,
      );
    }

    return {
      workspacesDeleted,
      spaceReclaimedBytes,
    };
  }

  async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await this.readDirectory(dirPath);

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else if (entry.isFile()) {
          try {
            const stats = await this.getFileStats(fullPath);
            totalSize += stats.size;
          } catch {
            // Ignorar archivos que desaparezcan durante el escaneo
          }
        }
      }
    } catch {
      // Ignorar si el directorio desaparece
    }

    return totalSize;
  }
}
