import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  MAINTENANCE_QUEUE,
  GARBAGE_COLLECTION_JOB,
  DEFAULT_CRON_SCHEDULE,
  DEFAULT_PRUNE_OLDER_THAN_HOURS,
} from './maintenance.constants.js';

@Injectable()
export class MaintenanceSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceSchedulerService.name);

  constructor(
    @Optional()
    @InjectQueue(MAINTENANCE_QUEUE)
    private readonly maintenanceQueue?: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    if (process.env.MAINTENANCE_CRON_ENABLED === 'false') {
      this.logger.log(
        '[MaintenanceScheduler] Tareas programadas de mantenimiento desactivadas por configuracion.',
      );
      return;
    }

    await this.setupRecurringGarbageCollection();
  }

  async setupRecurringGarbageCollection(): Promise<void> {
    if (!this.maintenanceQueue) {
      return;
    }

    const cronPattern =
      process.env.MAINTENANCE_CRON_SCHEDULE || DEFAULT_CRON_SCHEDULE;

    try {
      // Limpiar tareas repetibles previas para evitar duplicados
      const repeatableJobs = await this.maintenanceQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === GARBAGE_COLLECTION_JOB) {
          await this.maintenanceQueue.removeRepeatableByKey(job.key);
        }
      }

      await this.maintenanceQueue.add(
        GARBAGE_COLLECTION_JOB,
        { olderThanHours: DEFAULT_PRUNE_OLDER_THAN_HOURS },
        {
          repeat: {
            pattern: cronPattern,
          },
          removeOnComplete: 10,
          removeOnFail: 25,
        },
      );

      this.logger.log(
        `[MaintenanceScheduler] Cron job de Garbage Collection registrado con patron: "${cronPattern}"`,
      );
    } catch (error) {
      this.logger.warn(
        `[MaintenanceScheduler] No se pudo registrar la tarea repetible de mantenimiento: ${(error as Error).message}`,
      );
    }
  }

  async triggerImmediateJob(options?: Record<string, any>): Promise<string> {
    if (!this.maintenanceQueue) {
      throw new Error('Cola de mantenimiento no disponible');
    }

    const job = await this.maintenanceQueue.add(
      GARBAGE_COLLECTION_JOB,
      options || {},
      {
        removeOnComplete: 10,
        removeOnFail: 25,
      },
    );

    return String(job.id);
  }
}
