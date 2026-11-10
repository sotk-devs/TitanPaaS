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
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationEvent } from '../notifications/enums/notification-event.enum.js';

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
    @Optional()
    private readonly notificationsService?: NotificationsService,
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

    const abortSignal = data.deploymentId
      ? this.dockerPipeline?.registerDeploymentAbort?.(data.deploymentId)
      : undefined;

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
      `[Job #${job.id}] Iniciando pipeline de despliegue para ${data.repositoryName} (${data.branch})`,
    );
    this.logger.log(
      `Commit: ${data.commitSha.substring(0, 7)} - "${data.commitMessage}" por @${data.author}`,
    );

    emitStatus(DeploymentStatus.BUILDING, 0, 'starting');
    emitLog(
      `Starting deployment pipeline for ${data.repositoryName} (${data.branch})\nCommit: ${data.commitSha.substring(0, 7)} - "${data.commitMessage}" by @${data.author}\n`,
    );

    // Obtener configuración de proyecto si existe
    let port = 3000;
    let envVariables: Record<string, string> = {};
    let project: Project | null = null;

    if (data.projectId && this.projectRepository) {
      project = await this.projectRepository.findOne({
        where: { id: data.projectId },
        relations: ['customDomains'],
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
    let deploymentUrl: string | undefined;

    try {
      // Verificar si ya fue cancelado antes de iniciar
      if (data.deploymentId && this.deploymentRepository?.findOne) {
        const initialDep = await this.deploymentRepository.findOne({
          where: { id: data.deploymentId },
        });
        if (initialDep?.status === DeploymentStatus.CANCELLED) {
          throw new Error('Deployment was cancelled by user');
        }

        // Notificar estado BUILDING en base de datos
        await this.deploymentRepository.update(data.deploymentId, {
          status: DeploymentStatus.BUILDING,
          startedAt: new Date(startedAt),
        });
      } else if (data.deploymentId && this.deploymentRepository) {
        await this.deploymentRepository.update(data.deploymentId, {
          status: DeploymentStatus.BUILDING,
          startedAt: new Date(startedAt),
        });
      }

      if (data.projectId && this.notificationsService) {
        await this.notificationsService.notifyDeploymentEvent(
          NotificationEvent.DEPLOY_STARTED,
          {
            projectId: data.projectId,
            projectName: project?.name || data.repositoryName,
            repositoryName: data.repositoryName,
            deploymentId: data.deploymentId,
            branch: data.branch,
            commitSha: data.commitSha,
            commitMessage: data.commitMessage,
            author: data.author,
          },
        );
      }

      // Stage 1: Clonación del repositorio
      this.logger.log(
        `[Job #${job.id}] [1/4] Clonando repositorio desde ${data.cloneUrl}...`,
      );
      emitStatus(DeploymentStatus.BUILDING, 10, 'clone');
      emitLog(
        `[1/4] Cloning repository from ${data.cloneUrl} (${data.branch})...\n`,
      );

      const cloneResult = await this.dockerPipeline.cloneRepository(
        data.cloneUrl,
        data.branch,
        data.commitSha,
        workspaceDir,
        emitLog,
        abortSignal,
      );
      accumulatedLogs += `=== STAGE 1: CLONE ===\n${cloneResult.logs}\n\n`;
      await job.updateProgress(25);
      stages.push({
        name: 'clone',
        status: 'success',
        durationMs: cloneResult.durationMs,
      });

      // Verificar si fue cancelado durante la clonación
      if (data.deploymentId && this.deploymentRepository?.findOne) {
        const depCheck = await this.deploymentRepository.findOne({
          where: { id: data.deploymentId },
        });
        if (depCheck?.status === DeploymentStatus.CANCELLED) {
          throw new Error('Deployment was cancelled by user');
        }
      }

      // Stage 2: Compilación de imagen Docker
      this.logger.log(
        `[Job #${job.id}] [2/4] Compilando imagen Docker ${imageTag}...`,
      );
      emitStatus(DeploymentStatus.BUILDING, 30, 'build');
      emitLog(`[2/4] Building Docker image ${imageTag}...\n`);

      const buildResult = await this.dockerPipeline.buildImage(
        imageTag,
        workspaceDir,
        emitLog,
        abortSignal,
      );
      accumulatedLogs += `=== STAGE 2: BUILD ===\n${buildResult.logs}\n\n`;
      await job.updateProgress(50);
      stages.push({
        name: 'build',
        status: 'success',
        durationMs: buildResult.durationMs,
      });

      // Verificar si fue cancelado durante el build
      if (data.deploymentId && this.deploymentRepository?.findOne) {
        const depCheck = await this.deploymentRepository.findOne({
          where: { id: data.deploymentId },
        });
        if (depCheck?.status === DeploymentStatus.CANCELLED) {
          throw new Error('Deployment was cancelled by user');
        }
      }

      // Notificar estado DEPLOYING en base de datos
      if (data.deploymentId && this.deploymentRepository) {
        await this.deploymentRepository.update(data.deploymentId, {
          status: DeploymentStatus.DEPLOYING,
        });
      }

      // Stage 3: Creación y ejecución de contenedor Docker con soporte Traefik y streaming de logs
      this.logger.log(
        `[Job #${job.id}] [3/4] Desplegando contenedor Docker ${containerName} en puerto ${port}...`,
      );
      emitStatus(DeploymentStatus.DEPLOYING, 60, 'docker_deploy');
      emitLog(
        `[3/4] Deploying Docker container ${containerName} on port ${port}...\n`,
      );

      const subdomain = project?.name
        ? this.dockerPipeline.generateSubdomain(project.name)
        : this.dockerPipeline.generateSubdomain(data.repositoryName);

      const verifiedDomains =
        project?.customDomains
          ?.filter((d: any) => d.status === 'VERIFIED')
          ?.map((d: any) => d.domain) || [];

      const runResult = await this.dockerPipeline.runContainer(
        imageTag,
        containerName,
        port,
        envVariables,
        {
          subdomain,
          baseDomain: process.env.BASE_DOMAIN || 'localhost',
          network: process.env.DOCKER_NETWORK || 'titan-network',
          customDomains: verifiedDomains,
          onLog: emitLog,
          signal: abortSignal,
        },
      );
      containerId = runResult.containerId;
      deploymentUrl = runResult.url;
      if (deploymentUrl) {
        this.logger.log(
          `[Job #${job.id}] Enrutamiento dinámico activo en Traefik: ${deploymentUrl}`,
        );
        emitLog(`Dynamic routing active at Traefik: ${deploymentUrl}\n`);
      }
      accumulatedLogs += `=== STAGE 3: DOCKER DEPLOY ===\n${runResult.logs}\n\n`;
      await job.updateProgress(75);
      stages.push({
        name: 'docker_deploy',
        status: 'success',
        durationMs: runResult.durationMs,
      });

      // Stage 4: Verificación de salud (Healthcheck)
      this.logger.log(
        `[Job #${job.id}] [4/4] Verificando estado de salud del contenedor ${containerId}...`,
      );
      emitStatus(DeploymentStatus.DEPLOYING, 85, 'healthcheck');
      emitLog(`[4/4] Verifying health status of container ${containerId}...\n`);

      const healthResult = abortSignal
        ? await this.dockerPipeline.checkHealth(
            containerId,
            emitLog,
            abortSignal,
          )
        : await this.dockerPipeline.checkHealth(containerId, emitLog);
      accumulatedLogs += `=== STAGE 4: HEALTHCHECK ===\n${healthResult.logs}\n\n`;

      if (project?.healthcheckPath) {
        const rawPath = project.healthcheckPath.trim();
        const normalizedPath = rawPath.startsWith('/')
          ? rawPath
          : `/${rawPath}`;
        const targetUrl = deploymentUrl
          ? `${deploymentUrl}${normalizedPath}`
          : `http://localhost:${port}${normalizedPath}`;

        emitLog(
          `🌐 Executing HTTP healthcheck on ${targetUrl} (expected: ${project.healthcheckExpectedStatus || 200}, retries: ${project.healthcheckRetries || 3}, timeout: ${project.healthcheckTimeout || 5}s)...\n`,
        );

        const httpHealthResult = await this.dockerPipeline.checkHttpHealth({
          url: targetUrl,
          expectedStatus: project.healthcheckExpectedStatus || 200,
          timeoutSeconds: project.healthcheckTimeout || 5,
          retries: project.healthcheckRetries || 3,
          onLog: emitLog,
          signal: abortSignal,
        });

        accumulatedLogs += `=== HTTP HEALTHCHECK ===\n${httpHealthResult.logs}\n\n`;
      }
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
        `[Job #${job.id}] Despliegue completado exitosamente en ${durationMs}ms para ${data.repositoryName} (${data.branch})`,
      );
      emitStatus(DeploymentStatus.DEPLOYED, 100, 'completed');
      emitLog(`Deployment completed successfully in ${durationMs}ms\n`);

      if (data.projectId && this.notificationsService) {
        await this.notificationsService.notifyDeploymentEvent(
          NotificationEvent.DEPLOY_SUCCEEDED,
          {
            projectId: data.projectId,
            projectName: project?.name || data.repositoryName,
            repositoryName: data.repositoryName,
            deploymentId: data.deploymentId,
            branch: data.branch,
            commitSha: data.commitSha,
            commitMessage: data.commitMessage,
            author: data.author,
            url: deploymentUrl,
            durationMs,
          },
        );
      }

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
        url: deploymentUrl,
      };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const errorMessage = (error as Error).message;
      accumulatedLogs += `\nERROR: ${errorMessage}\n`;

      const isCancelled =
        errorMessage.includes('cancelled') ||
        (error as Error).name === 'AbortError';

      let finalStatus = DeploymentStatus.FAILED;
      if (data.deploymentId && this.deploymentRepository) {
        if (this.deploymentRepository.findOne) {
          const currentDep = await this.deploymentRepository.findOne({
            where: { id: data.deploymentId },
          });
          if (
            currentDep?.status === DeploymentStatus.CANCELLED ||
            isCancelled
          ) {
            finalStatus = DeploymentStatus.CANCELLED;
          }
        } else if (isCancelled) {
          finalStatus = DeploymentStatus.CANCELLED;
        }

        // Rollback automático: si el fallo no fue una cancelación y existe un despliegue previo DEPLOYED,
        // restaurar el contenedor anterior para evitar caída del servicio
        if (
          !isCancelled &&
          data.projectId &&
          this.deploymentRepository.findOne &&
          this.dockerPipeline
        ) {
          try {
            const previousSuccess = await this.deploymentRepository.findOne({
              where: {
                projectId: data.projectId,
                status: DeploymentStatus.DEPLOYED,
              },
              order: { finishedAt: 'DESC' },
            });

            if (previousSuccess && previousSuccess.id !== data.deploymentId) {
              this.logger.warn(
                `[Auto-Rollback] Restaurando contenedor del despliegue previo exitoso #${previousSuccess.id}...`,
              );
              emitLog(
                `\n[Auto-Rollback] Deployment failed. Automatically restoring previous healthy deployment #${previousSuccess.id}...\n`,
                'stdout',
              );

              const prevImage = this.dockerPipeline.generateImageTag(
                data.repositoryName,
                previousSuccess.commitSha || 'latest',
              );
              const subdomain = project?.name
                ? this.dockerPipeline.generateSubdomain(project.name)
                : this.dockerPipeline.generateSubdomain(data.repositoryName);

              await this.dockerPipeline.runContainer(
                prevImage,
                containerName,
                port,
                envVariables,
                {
                  subdomain,
                  baseDomain: process.env.BASE_DOMAIN || 'localhost',
                  network: process.env.DOCKER_NETWORK || 'titan-network',
                  onLog: emitLog,
                },
              );

              accumulatedLogs += `\n=== AUTOMATIC ROLLBACK ===\nSuccessfully restored previous deployment #${previousSuccess.id}\n`;
              emitLog(
                `[Auto-Rollback] Restored deployment #${previousSuccess.id}\n`,
              );
            }
          } catch (rollbackError) {
            this.logger.error(
              `[Auto-Rollback] Error al intentar restaurar despliegue previo: ${(rollbackError as Error).message}`,
            );
          }
        }

        await this.deploymentRepository.update(data.deploymentId, {
          status: finalStatus,
          logs: accumulatedLogs,
          stages: stages as any,
          finishedAt: new Date(finishedAt),
        });
      }

      emitStatus(finalStatus, undefined, isCancelled ? 'cancelled' : 'failed');
      emitLog(`\nERROR: ${errorMessage}\n`, 'stderr');

      if (
        finalStatus === DeploymentStatus.FAILED &&
        data.projectId &&
        this.notificationsService
      ) {
        await this.notificationsService.notifyDeploymentEvent(
          NotificationEvent.DEPLOY_FAILED,
          {
            projectId: data.projectId,
            projectName: project?.name || data.repositoryName,
            repositoryName: data.repositoryName,
            deploymentId: data.deploymentId,
            branch: data.branch,
            commitSha: data.commitSha,
            commitMessage: data.commitMessage,
            author: data.author,
            durationMs: Date.now() - startTime,
            errorMessage,
          },
        );
      }

      throw error;
    } finally {
      if (data.deploymentId) {
        this.dockerPipeline?.unregisterDeploymentAbort?.(data.deploymentId);
      }
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
      `[Worker] Tarea #${job.id} falló con error: ${error.message}`,
    );
  }
}
