import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DEPLOY_QUEUE, DEPLOY_JOB } from '../webhooks/webhooks.constants.js';
import { DeploymentJobData } from '../webhooks/interfaces/github-payload.interface.js';
import {
  DeploymentResult,
  DeploymentStage,
} from './interfaces/deployment-result.interface.js';
import { DockerPipelineService } from './docker-pipeline.service.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentStatus } from '../deployments/enums/deployment-status.enum.js';
import { LogsGateway } from '../logs/logs.gateway.js';

@Processor(DEPLOY_QUEUE)
export class DeploymentWorker extends WorkerHost {
  private readonly logger = new Logger(DeploymentWorker.name);

  constructor(
    private readonly dockerPipeline: DockerPipelineService,
    @Optional()
    @InjectRepository(Deployment)
    private readonly deploymentRepository?: Repository<Deployment>,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepository?: Repository<Project>,
    @Optional()
    private readonly logsGateway?: LogsGateway,
  ) {
    super();
  }

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
    let accumulatedLogs = '';

    const emitLog = (chunk: string, stream: 'stdout' | 'stderr' = 'stdout') => {
      if (data.deploymentId && this.logsGateway) {
        this.logsGateway.emitLog(data.deploymentId, chunk, stream);
      }
    };

    const emitStatus = (
      status: DeploymentStatus,
      progress?: number,
      stage?: string,
    ) => {
      if (data.deploymentId && this.logsGateway) {
        this.logsGateway.emitStatus(data.deploymentId, status, progress, stage);
      }
    };

    this.logger.log(
      `🚀 [Job #${job.id}] Iniciando pipeline de despliegue para ${data.repositoryName} (${data.branch})`,
    );
    this.logger.log(
      `📦 Commit: ${data.commitSha.substring(0, 7)} - "${data.commitMessage}" por @${data.author}`,
    );

    emitStatus(DeploymentStatus.BUILDING, 0, 'starting');
    emitLog(
      `🚀 Starting deployment pipeline for ${data.repositoryName} (${data.branch})\nCommit: ${data.commitSha.substring(0, 7)} - "${data.commitMessage}" by @${data.author}\n`,
    );

    // Obtener configuración de proyecto si existe
    let port = 3000;
    let envVariables: Record<string, string> = {};

    if (data.projectId && this.projectRepository) {
      const project = await this.projectRepository.findOne({
        where: { id: data.projectId },
      });
      if (project) {
        port = project.port || 3000;
        envVariables = project.envVariables || {};
      }
    }

    const stages: DeploymentStage[] = [];
    const workspaceDir = this.dockerPipeline.getWorkspacePath(
      data.repositoryName,
      data.commitSha,
    );
    const imageTag = this.dockerPipeline.generateImageTag(
      data.repositoryName,
      data.commitSha,
    );
    const containerName = this.dockerPipeline.generateContainerName(
      data.repositoryName,
    );

    let containerId: string;

    try {
      // Notificar estado BUILDING en base de datos
      if (data.deploymentId && this.deploymentRepository) {
        await this.deploymentRepository.update(data.deploymentId, {
          status: DeploymentStatus.BUILDING,
          startedAt: new Date(startedAt),
        });
      }

      // Stage 1: Clonación del repositorio
      this.logger.log(
        `📥 [Job #${job.id}] [1/4] Clonando repositorio desde ${data.cloneUrl}...`,
      );
      emitStatus(DeploymentStatus.BUILDING, 10, 'clone');
      emitLog(
        `📥 [1/4] Cloning repository from ${data.cloneUrl} (${data.branch})...\n`,
      );

      const cloneResult = await this.dockerPipeline.cloneRepository(
        data.cloneUrl,
        data.branch,
        data.commitSha,
        workspaceDir,
        emitLog,
      );
      accumulatedLogs += `=== STAGE 1: CLONE ===\n${cloneResult.logs}\n\n`;
      await job.updateProgress(25);
      stages.push({
        name: 'clone',
        status: 'success',
        durationMs: cloneResult.durationMs,
      });

      // Stage 2: Compilación de imagen Docker
      this.logger.log(
        `🔨 [Job #${job.id}] [2/4] Compilando imagen Docker ${imageTag}...`,
      );
      emitStatus(DeploymentStatus.BUILDING, 30, 'build');
      emitLog(`🔨 [2/4] Building Docker image ${imageTag}...\n`);

      const buildResult = await this.dockerPipeline.buildImage(
        imageTag,
        workspaceDir,
        emitLog,
      );
      accumulatedLogs += `=== STAGE 2: BUILD ===\n${buildResult.logs}\n\n`;
      await job.updateProgress(50);
      stages.push({
        name: 'build',
        status: 'success',
        durationMs: buildResult.durationMs,
      });

      // Notificar estado DEPLOYING en base de datos
      if (data.deploymentId && this.deploymentRepository) {
        await this.deploymentRepository.update(data.deploymentId, {
          status: DeploymentStatus.DEPLOYING,
        });
      }

      // Stage 3: Creación y ejecución de contenedor Docker
      this.logger.log(
        `🐳 [Job #${job.id}] [3/4] Desplegando contenedor Docker ${containerName} en puerto ${port}...`,
      );
      emitStatus(DeploymentStatus.DEPLOYING, 60, 'docker_deploy');
      emitLog(
        `🐳 [3/4] Deploying Docker container ${containerName} on port ${port}...\n`,
      );

      const runResult = await this.dockerPipeline.runContainer(
        imageTag,
        containerName,
        port,
        envVariables,
        emitLog,
      );
      containerId = runResult.containerId;
      accumulatedLogs += `=== STAGE 3: DOCKER DEPLOY ===\n${runResult.logs}\n\n`;
      await job.updateProgress(75);
      stages.push({
        name: 'docker_deploy',
        status: 'success',
        durationMs: runResult.durationMs,
      });

      // Stage 4: Verificación de salud (Healthcheck)
      this.logger.log(
        `🩺 [Job #${job.id}] [4/4] Verificando estado de salud del contenedor ${containerId}...`,
      );
      emitStatus(DeploymentStatus.DEPLOYING, 85, 'healthcheck');
      emitLog(
        `🩺 [4/4] Verifying health status of container ${containerId}...\n`,
      );

      const healthResult = await this.dockerPipeline.checkHealth(
        containerId,
        emitLog,
      );
      accumulatedLogs += `=== STAGE 4: HEALTHCHECK ===\n${healthResult.logs}\n\n`;
      await job.updateProgress(100);
      stages.push({
        name: 'healthcheck',
        status: 'success',
        durationMs: healthResult.durationMs,
      });

      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      // Actualizar registro en BD a DEPLOYED
      if (data.deploymentId && this.deploymentRepository) {
        await this.deploymentRepository.update(data.deploymentId, {
          status: DeploymentStatus.DEPLOYED,
          containerId,
          logs: accumulatedLogs,
          stages: stages as any,
          finishedAt: new Date(finishedAt),
        });
      }

      this.logger.log(
        `✅ [Job #${job.id}] Despliegue completado exitosamente en ${durationMs}ms para ${data.repositoryName} (${data.branch})`,
      );
      emitStatus(DeploymentStatus.DEPLOYED, 100, 'completed');
      emitLog(`✅ Deployment completed successfully in ${durationMs}ms\n`);

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
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const errorMessage = (error as Error).message;
      accumulatedLogs += `\n❌ ERROR: ${errorMessage}\n`;

      emitStatus(DeploymentStatus.FAILED, undefined, 'failed');
      emitLog(`\n❌ ERROR: ${errorMessage}\n`, 'stderr');

      if (data.deploymentId && this.deploymentRepository) {
        await this.deploymentRepository.update(data.deploymentId, {
          status: DeploymentStatus.FAILED,
          logs: accumulatedLogs,
          stages: stages as any,
          finishedAt: new Date(finishedAt),
        });
      }

      throw error;
    } finally {
      // Limpieza de workspace temporal
      await this.dockerPipeline.cleanup(workspaceDir);
    }
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
}
