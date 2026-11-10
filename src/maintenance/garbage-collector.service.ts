import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { DockerPruneService } from './docker-prune.service.js';
import { WorkspaceCleanerService } from './workspace-cleaner.service.js';
import {
  DEFAULT_PRUNE_OLDER_THAN_HOURS,
  DEFAULT_CRON_SCHEDULE,
} from './maintenance.constants.js';
import type {
  GarbageCollectionOptions,
  GarbageCollectionResult,
  GarbageCollectionStatus,
  DockerPruneResult,
  WorkspaceCleanResult,
} from './interfaces/garbage-collector.interface.js';

@Injectable()
export class GarbageCollectorService {
  private readonly logger = new Logger(GarbageCollectorService.name);
  private isRunning = false;
  private lastRun: GarbageCollectionResult | null = null;

  constructor(
    private readonly dockerPruneService: DockerPruneService,
    private readonly workspaceCleanerService: WorkspaceCleanerService,
  ) {}

  async runGarbageCollection(
    options: GarbageCollectionOptions = {},
  ): Promise<GarbageCollectionResult> {
    if (this.isRunning) {
      throw new ConflictException(
        'Una tarea de Garbage Collection ya se encuentra en ejecucion',
      );
    }

    this.isRunning = true;
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    const olderThanHours =
      options.olderThanHours ?? DEFAULT_PRUNE_OLDER_THAN_HOURS;
    const pruneImages = options.pruneImages ?? true;
    const pruneContainers = options.pruneContainers ?? true;
    const pruneVolumes = options.pruneVolumes ?? false;
    const cleanWorkspaces = options.cleanWorkspaces ?? true;

    this.logger.log(
      `[GarbageCollector] Iniciando ciclo de limpieza (olderThan: ${olderThanHours}h, images: ${pruneImages}, containers: ${pruneContainers}, volumes: ${pruneVolumes}, workspaces: ${cleanWorkspaces})`,
    );

    const dockerResult: DockerPruneResult = {
      images: { deleted: [], spaceReclaimedBytes: 0, raw: '' },
      containers: { deleted: [], spaceReclaimedBytes: 0, raw: '' },
      volumes: { deleted: [], spaceReclaimedBytes: 0, raw: '' },
      totalSpaceReclaimedBytes: 0,
    };

    let workspaceResult: WorkspaceCleanResult = {
      workspacesDeleted: [],
      spaceReclaimedBytes: 0,
    };

    try {
      if (pruneContainers) {
        dockerResult.containers =
          await this.dockerPruneService.pruneContainers(olderThanHours);
      }

      if (pruneImages) {
        dockerResult.images =
          await this.dockerPruneService.pruneImages(olderThanHours);
      }

      if (pruneVolumes) {
        dockerResult.volumes = await this.dockerPruneService.pruneVolumes();
      }

      dockerResult.totalSpaceReclaimedBytes =
        dockerResult.images.spaceReclaimedBytes +
        dockerResult.containers.spaceReclaimedBytes +
        dockerResult.volumes.spaceReclaimedBytes;

      if (cleanWorkspaces) {
        workspaceResult =
          await this.workspaceCleanerService.cleanStaleWorkspaces(
            olderThanHours,
          );
      }

      const totalSpaceReclaimedBytes =
        dockerResult.totalSpaceReclaimedBytes +
        workspaceResult.spaceReclaimedBytes;
      const durationMs = Date.now() - startTime;
      const finishedAt = new Date().toISOString();

      const result: GarbageCollectionResult = {
        success: true,
        startedAt,
        finishedAt,
        durationMs,
        imagesDeletedCount: dockerResult.images.deleted.length,
        containersDeletedCount: dockerResult.containers.deleted.length,
        volumesDeletedCount: dockerResult.volumes.deleted.length,
        workspacesDeletedCount: workspaceResult.workspacesDeleted.length,
        totalSpaceReclaimedBytes,
        totalSpaceReclaimedFormatted: this.formatBytes(
          totalSpaceReclaimedBytes,
        ),
        details: {
          docker: dockerResult,
          workspaces: workspaceResult,
        },
      };

      this.lastRun = result;

      this.logger.log(
        `[GarbageCollector] Ciclo finalizado en ${durationMs}ms. Espacio total liberado: ${result.totalSpaceReclaimedFormatted} (Imagenes: ${result.imagesDeletedCount}, Contenedores: ${result.containersDeletedCount}, Volumenes: ${result.volumesDeletedCount}, Workspaces: ${result.workspacesDeletedCount})`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[GarbageCollector] Error critico durante ciclo de limpieza: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  getStatus(): GarbageCollectionStatus {
    const cronSchedule =
      process.env.MAINTENANCE_CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE;

    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      scheduler: {
        enabled: process.env.MAINTENANCE_CRON_ENABLED !== 'false',
        cronExpression: cronSchedule,
      },
    };
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}
