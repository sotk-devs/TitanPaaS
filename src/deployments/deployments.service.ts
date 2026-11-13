import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Deployment } from './entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentPaginationQueryDto } from './dto/deployment-pagination-query.dto.js';
import { TriggerDeployDto } from './dto/trigger-deploy.dto.js';
import { RollbackDeployDto } from './dto/rollback-deploy.dto.js';
import { LogDownloadFormat } from './dto/download-logs-query.dto.js';
import { DeploymentStatus } from './enums/deployment-status.enum.js';
import { DEPLOY_QUEUE, DEPLOY_JOB } from '../webhooks/webhooks.constants.js';
import type { DeploymentJobData } from '../webhooks/interfaces/github-payload.interface.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';
import { LogsGateway } from '../logs/logs.gateway.js';
import { TeamsService } from '../teams/teams.service.js';
import { TeamRole } from '../teams/enums/team-role.enum.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/enums/audit-action.enum.js';
import { AuditResourceType } from '../audit/enums/audit-resource-type.enum.js';

export interface DownloadLogsResult {
  filename: string;
  contentType: string;
  content: string;
}

export interface PaginatedDeployments {
  items: Deployment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(
    @InjectRepository(Deployment)
    private readonly deploymentRepository: Repository<Deployment>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @Optional()
    @InjectQueue(DEPLOY_QUEUE)
    private readonly deployQueue?: Queue,
    @Optional()
    private readonly dockerPipeline?: DockerPipelineService,
    @Optional()
    private readonly logsGateway?: LogsGateway,
    @Optional()
    private readonly teamsService?: TeamsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  private async findProjectWithAccess(
    userId: string,
    projectId: string,
    allowedTeamRoles?: TeamRole[],
  ): Promise<Project> {
    if (!this.teamsService) {
      const project = await this.projectRepository.findOne({
        where: { id: projectId, userId },
      });

      if (!project) {
        throw new NotFoundException(
          `Proyecto #${projectId} no encontrado o no pertenece al usuario autenticado.`,
        );
      }

      return project;
    }

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    await this.teamsService.assertProjectAccess(
      userId,
      project,
      allowedTeamRoles,
      `Proyecto #${projectId} no encontrado o no pertenece al usuario autenticado.`,
    );

    return project!;
  }

  private async findDeploymentWithAccess(
    userId: string,
    id: string,
    allowedTeamRoles?: TeamRole[],
  ): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
      relations: ['project'],
    });

    if (!this.teamsService) {
      if (!deployment || deployment.project?.userId !== userId) {
        throw new NotFoundException(
          `Despliegue #${id} no encontrado o no pertenece a un proyecto del usuario autenticado.`,
        );
      }

      return deployment;
    }

    if (!deployment || !deployment.project) {
      throw new NotFoundException(
        `Despliegue #${id} no encontrado o no pertenece a un proyecto del usuario autenticado.`,
      );
    }

    await this.teamsService.assertProjectAccess(
      userId,
      deployment.project,
      allowedTeamRoles,
      `Despliegue #${id} no encontrado o no pertenece a un proyecto del usuario autenticado.`,
    );

    return deployment;
  }

  async findByProject(
    userId: string,
    projectId: string,
    query?: DeploymentPaginationQueryDto,
  ): Promise<PaginatedDeployments> {
    await this.findProjectWithAccess(userId, projectId);

    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 20));
    const skip = (page - 1) * limit;

    const [items, total] = await this.deploymentRepository.findAndCount({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(userId: string, id: string): Promise<Deployment> {
    return this.findDeploymentWithAccess(userId, id);
  }

  async triggerManualDeploy(
    userId: string,
    projectId: string,
    dto?: TriggerDeployDto,
    user?: { id?: string; email?: string; name?: string },
  ): Promise<Deployment & { jobId?: string }> {
    const project = await this.findProjectWithAccess(userId, projectId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.DEVELOPER,
    ]);

    const branch = dto?.branch?.trim() || project.branch || 'main';
    const commitSha = dto?.commitSha?.trim() || 'HEAD';
    const author = user?.name || user?.email || 'Manual Trigger';
    const commitMessage =
      dto?.commitMessage?.trim() ||
      `Manual deploy triggered on branch ${branch} by @${author}`;

    const newDeployment = this.deploymentRepository.create({
      projectId: project.id,
      status: DeploymentStatus.QUEUED,
      branch,
      commitSha,
      commitMessage,
      startedAt: new Date(),
    });

    const savedDeployment = await this.deploymentRepository.save(newDeployment);
    this.logger.log(
      `Despliegue manual #${savedDeployment.id} registrado con estado QUEUED para el proyecto "${project.name}" (${project.id}).`,
    );

    let jobId: string | undefined;

    if (this.deployQueue) {
      const deliveryId = randomUUID();
      const jobData: DeploymentJobData = {
        deliveryId,
        deploymentId: savedDeployment.id,
        projectId: project.id,
        repositoryName: project.repositoryName,
        cloneUrl: project.repositoryUrl,
        branch,
        commitSha,
        commitMessage,
        author,
        receivedAt: new Date().toISOString(),
      };

      const job = await this.deployQueue.add(DEPLOY_JOB, jobData, {
        jobId: deliveryId,
        removeOnComplete: true,
        attempts: 3,
      });

      jobId = String(job.id);
      this.logger.log(
        `Despliegue manual #${savedDeployment.id} encolado en BullMQ con Job ID: ${jobId}.`,
      );
    }

    await this.auditService?.record({
      userId,
      action: AuditAction.DEPLOYMENT_TRIGGER,
      resourceType: AuditResourceType.DEPLOYMENT,
      resourceId: savedDeployment.id,
      projectId: project.id,
      details: {
        branch,
        commitSha,
        commitMessage,
        author,
        trigger: 'manual',
      },
    });

    return Object.assign(savedDeployment, { jobId });
  }

  async cancelDeployment(userId: string, id: string): Promise<Deployment> {
    const deployment = await this.findDeploymentWithAccess(userId, id, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.DEVELOPER,
    ]);

    const nonCancellableStatuses = [
      DeploymentStatus.DEPLOYED,
      DeploymentStatus.FAILED,
      DeploymentStatus.STOPPED,
      DeploymentStatus.CANCELLED,
    ];

    if (nonCancellableStatuses.includes(deployment.status)) {
      throw new BadRequestException(
        `El despliegue ya se encuentra en estado "${deployment.status}" y no puede ser cancelado.`,
      );
    }

    // 1. Remover trabajo de la cola BullMQ si se encuentra en espera o retrasado
    if (this.deployQueue) {
      try {
        const waitingJobs = await this.deployQueue.getJobs([
          'waiting',
          'delayed',
          'prioritized',
        ]);
        for (const job of waitingJobs) {
          if (
            job.data?.deploymentId === id ||
            job.id === id ||
            job.data?.deliveryId === id
          ) {
            await job.remove();
            this.logger.log(
              `Trabajo #${job.id} asociado al despliegue #${id} removido de la cola BullMQ.`,
            );
          }
        }
      } catch (queueErr) {
        this.logger.warn(
          `Error al buscar/remover trabajo encolado en BullMQ para el despliegue #${id}: ${(queueErr as Error).message}`,
        );
      }
    }

    // 2. Abortar procesos de compilación o clonación si están en ejecución
    if (this.dockerPipeline) {
      try {
        const aborted = this.dockerPipeline.abortDeployment(id);
        if (aborted) {
          this.logger.log(
            `Procesos activos del despliegue #${id} abortados exitosamente.`,
          );
        }
      } catch (procErr) {
        this.logger.warn(
          `Error al abortar procesos activos del despliegue #${id}: ${(procErr as Error).message}`,
        );
      }
    }

    // 3. Actualizar estado a CANCELLED en base de datos
    deployment.status = DeploymentStatus.CANCELLED;
    deployment.finishedAt = new Date();
    const cancellationNote = '\nDespliegue cancelado por el usuario.\n';
    deployment.logs = (deployment.logs || '') + cancellationNote;

    const savedDeployment = await this.deploymentRepository.save(deployment);

    // 4. Emitir evento por WebSocket si LogsGateway está disponible
    if (this.logsGateway) {
      try {
        this.logsGateway.emitStatus(
          id,
          DeploymentStatus.CANCELLED,
          undefined,
          'cancelled',
        );
        this.logsGateway.emitLog(
          id,
          '\nDeployment was cancelled by user.\n',
          'stderr',
        );
      } catch (wsErr) {
        this.logger.warn(
          `Error al emitir eventos WebSocket para despliegue #${id}: ${(wsErr as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Despliegue #${id} cancelado exitosamente por el usuario ${userId}.`,
    );

    await this.auditService?.record({
      userId,
      action: AuditAction.DEPLOYMENT_CANCEL,
      resourceType: AuditResourceType.DEPLOYMENT,
      resourceId: savedDeployment.id,
      projectId: savedDeployment.projectId,
      details: {
        deploymentId: savedDeployment.id,
        status: DeploymentStatus.CANCELLED,
      },
    });

    return savedDeployment;
  }

  async rollbackDeployment(
    userId: string,
    id: string,
    dto?: RollbackDeployDto,
    user?: { id?: string; email?: string; name?: string },
  ): Promise<Deployment & { jobId?: string }> {
    const deployment = await this.findDeploymentWithAccess(userId, id, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.DEVELOPER,
    ]);

    const project = deployment.project;

    // Determinar el despliegue objetivo exitoso al cual regresar
    const targetDeployment =
      deployment.status === DeploymentStatus.DEPLOYED
        ? deployment
        : await this.deploymentRepository.findOne({
            where: {
              projectId: project.id,
              status: DeploymentStatus.DEPLOYED,
            },
            order: { finishedAt: 'DESC' },
          });

    if (!targetDeployment) {
      throw new BadRequestException(
        `No se encontró ningún despliegue previo exitoso (DEPLOYED) para el proyecto "${project.name}" al cual realizar rollback.`,
      );
    }

    const branch = targetDeployment.branch || project.branch || 'main';
    const commitSha = targetDeployment.commitSha || 'HEAD';
    const author = user?.name || user?.email || 'Rollback System';
    const shortSha =
      commitSha.length >= 7 ? commitSha.substring(0, 7) : commitSha;
    const defaultMsg = `Rollback to deployment #${targetDeployment.id} (${shortSha})`;
    const commitMessage = dto?.reason?.trim()
      ? `Rollback to #${targetDeployment.id}: ${dto.reason.trim()}`
      : defaultMsg;

    const rollbackDeployment = this.deploymentRepository.create({
      projectId: project.id,
      status: DeploymentStatus.QUEUED,
      branch,
      commitSha,
      commitMessage,
      startedAt: new Date(),
    });

    const savedDeployment =
      await this.deploymentRepository.save(rollbackDeployment);
    this.logger.log(
      `Rollback #${savedDeployment.id} registrado con estado QUEUED hacia el despliegue #${targetDeployment.id} para el proyecto "${project.name}".`,
    );

    let jobId: string | undefined;

    if (this.deployQueue) {
      const deliveryId = randomUUID();
      const jobData: DeploymentJobData = {
        deliveryId,
        deploymentId: savedDeployment.id,
        projectId: project.id,
        repositoryName: project.repositoryName,
        cloneUrl: project.repositoryUrl,
        branch,
        commitSha,
        commitMessage,
        author,
        receivedAt: new Date().toISOString(),
      };

      const job = await this.deployQueue.add(DEPLOY_JOB, jobData, {
        jobId: deliveryId,
        removeOnComplete: true,
        attempts: 3,
      });

      jobId = String(job.id);
      this.logger.log(
        `Rollback #${savedDeployment.id} encolado en BullMQ con Job ID: ${jobId}.`,
      );
    }

    await this.auditService?.record({
      userId,
      action: AuditAction.DEPLOYMENT_ROLLBACK,
      resourceType: AuditResourceType.DEPLOYMENT,
      resourceId: savedDeployment.id,
      projectId: project.id,
      details: {
        sourceDeploymentId: targetDeployment.id,
        targetCommitSha: targetDeployment.commitSha,
        branch,
      },
    });

    return Object.assign(savedDeployment, { jobId });
  }

  async getDeploymentLogsForDownload(
    userId: string,
    id: string,
    format: LogDownloadFormat = LogDownloadFormat.TXT,
  ): Promise<DownloadLogsResult> {
    const deployment = await this.findOne(userId, id);
    const projectName = deployment.project?.name || 'project';
    const sanitizedProjectName = projectName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    const logs = deployment.logs || '';

    if (format === LogDownloadFormat.JSON) {
      const jsonPayload = {
        deploymentId: deployment.id,
        projectId: deployment.projectId,
        projectName: deployment.project?.name,
        status: deployment.status,
        commitSha: deployment.commitSha,
        commitMessage: deployment.commitMessage,
        branch: deployment.branch,
        startedAt: deployment.startedAt,
        finishedAt: deployment.finishedAt,
        stages: deployment.stages || [],
        logs,
      };

      return {
        filename: `${sanitizedProjectName}-deployment-${deployment.id.substring(0, 8)}-logs.json`,
        contentType: 'application/json; charset=utf-8',
        content: JSON.stringify(jsonPayload, null, 2),
      };
    }

    return {
      filename: `${sanitizedProjectName}-deployment-${deployment.id.substring(0, 8)}-logs.txt`,
      contentType: 'text/plain; charset=utf-8',
      content: logs,
    };
  }
}
