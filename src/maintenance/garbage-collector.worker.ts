import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  MAINTENANCE_QUEUE,
  GARBAGE_COLLECTION_JOB,
} from './maintenance.constants.js';
import { GarbageCollectorService } from './garbage-collector.service.js';
import type {
  GarbageCollectionOptions,
  GarbageCollectionResult,
} from './interfaces/garbage-collector.interface.js';

@Processor(MAINTENANCE_QUEUE)
export class GarbageCollectorWorker extends WorkerHost {
  private readonly logger = new Logger(GarbageCollectorWorker.name);

  constructor(
    private readonly garbageCollectorService: GarbageCollectorService,
  ) {
    super();
  }

  async process(
    job: Job<GarbageCollectionOptions, GarbageCollectionResult, string>,
  ): Promise<GarbageCollectionResult> {
    if (job.name !== GARBAGE_COLLECTION_JOB) {
      this.logger.warn(
        `Ignorando tarea de mantenimiento no reconocida: ${job.name}`,
      );
      throw new Error(`Unsupported maintenance job: ${job.name}`);
    }

    this.logger.log(
      `[Worker] Iniciando ejecucion de tarea de Garbage Collection #${job.id}`,
    );

    await job.updateProgress(10);
    const options = job.data || {};

    await job.updateProgress(30);
    const result =
      await this.garbageCollectorService.runGarbageCollection(options);

    await job.updateProgress(100);
    return result;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(
      `[Worker] Tarea de Garbage Collection #${job.id} completada exitosamente.`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `[Worker] Tarea de Garbage Collection #${job.id} fallo: ${error.message}`,
    );
  }
}
