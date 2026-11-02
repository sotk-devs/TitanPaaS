import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DEPLOY_QUEUE, DEPLOY_JOB } from '../webhooks/webhooks.constants.js';
import { DeploymentJobData } from '../webhooks/interfaces/github-payload.interface.js';
import {
  DeploymentResult,
  DeploymentStage,
} from './interfaces/deployment-result.interface.js';

@Processor(DEPLOY_QUEUE)
export class DeploymentWorker extends WorkerHost {
  private readonly logger = new Logger(DeploymentWorker.name);

  async process(
    job: Job<DeploymentJobData, DeploymentResult, string>,
  ): Promise<DeploymentResult> {
    if (job.name !== DEPLOY_JOB) {
      this.logger.warn(
        `Ignorando trabajo con identificador no soportado: ${job.name}`,
      );
      throw new Error(`Unsupported job name: ${job.name}`);
    }

    const data = job.data;
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    this.logger.log(
      `🚀 [Job #${job.id}] Iniciando pipeline de despliegue para ${data.repositoryName} (${data.branch})`,
    );
    this.logger.log(
      `📦 Commit: ${data.commitSha.substring(0, 7)} - "${data.commitMessage}" por @${data.author}`,
    );

    const stages: DeploymentStage[] = [];

    // Stage 1: Clonación del repositorio
    const stage1Start = Date.now();
    this.logger.log(
      `📥 [Job #${job.id}] [1/4] Clonando repositorio desde ${data.cloneUrl}...`,
    );
    await job.updateProgress(25);
    await this.simulateDelay(50);
    stages.push({
      name: 'clone',
      status: 'success',
      durationMs: Date.now() - stage1Start,
    });

    // Stage 2: Instalación de dependencias y compilación
    const stage2Start = Date.now();
    this.logger.log(
      `🔨 [Job #${job.id}] [2/4] Instalando dependencias y compilando artefactos...`,
    );
    await job.updateProgress(50);
    await this.simulateDelay(50);
    stages.push({
      name: 'build',
      status: 'success',
      durationMs: Date.now() - stage2Start,
    });

    // Stage 3: Creación y ejecución de contenedor Docker
    const stage3Start = Date.now();
    this.logger.log(
      `🐳 [Job #${job.id}] [3/4] Creando contenedor Docker para ${data.repositoryName}...`,
    );
    await job.updateProgress(75);
    await this.simulateDelay(50);
    stages.push({
      name: 'docker_deploy',
      status: 'success',
      durationMs: Date.now() - stage3Start,
    });

    // Stage 4: Verificación de salud (Healthcheck)
    const stage4Start = Date.now();
    this.logger.log(
      `🩺 [Job #${job.id}] [4/4] Verificando estado de salud del contenedor...`,
    );
    await job.updateProgress(100);
    await this.simulateDelay(25);
    stages.push({
      name: 'healthcheck',
      status: 'success',
      durationMs: Date.now() - stage4Start,
    });

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;

    this.logger.log(
      `✅ [Job #${job.id}] Despliegue completado exitosamente en ${durationMs}ms para ${data.repositoryName} (${data.branch})`,
    );

    return {
      jobId: String(job.id),
      deliveryId: data.deliveryId,
      repositoryName: data.repositoryName,
      branch: data.branch,
      commitSha: data.commitSha,
      status: 'completed',
      startedAt,
      finishedAt,
      durationMs,
      stages,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`[Worker] Tarea #${job.id} finalizada exitosamente.`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `[Worker] Tarea #${job?.id} falló con error: ${error.message}`,
    );
  }

  protected simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
