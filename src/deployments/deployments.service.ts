import {
  Injectable,
  NotFoundException,
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
import { DeploymentStatus } from './enums/deployment-status.enum.js';
import { DEPLOY_QUEUE, DEPLOY_JOB } from '../webhooks/webhooks.constants.js';
import type { DeploymentJobData } from '../webhooks/interfaces/github-payload.interface.js';

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
  ) {}

  async findByProject(
    userId: string,
    projectId: string,
    query?: DeploymentPaginationQueryDto,
  ): Promise<PaginatedDeployments> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto #${projectId} no encontrado o no pertenece al usuario autenticado.`,
      );
    }

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
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
      relations: ['project'],
    });

    if (!deployment || deployment.project?.userId !== userId) {
      throw new NotFoundException(
        `Despliegue #${id} no encontrado o no pertenece a un proyecto del usuario autenticado.`,
      );
    }

    return deployment;
  }

  async triggerManualDeploy(
    userId: string,
    projectId: string,
    dto?: TriggerDeployDto,
    user?: { id?: string; email?: string; name?: string },
  ): Promise<Deployment & { jobId?: string }> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto #${projectId} no encontrado o no pertenece al usuario autenticado.`,
      );
    }

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

    return Object.assign(savedDeployment, { jobId });
  }
}
