import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { DEPLOY_JOB, DEPLOY_QUEUE } from './webhooks.constants.js';
import {
  DeploymentJobData,
  GitHubPushPayload,
} from './interfaces/github-payload.interface.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { DeploymentStatus } from '../deployments/enums/deployment-status.enum.js';

export interface EnqueueResult {
  queued: boolean;
  jobId?: string;
  deploymentId?: string;
  projectId?: string;
  queue?: string;
  repository: string;
  branch: string;
  commitSha: string;
  reason?: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectQueue(DEPLOY_QUEUE)
    private readonly deployQueue: Queue,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepository?: Repository<Project>,
    @Optional()
    @InjectRepository(Deployment)
    private readonly deploymentRepository?: Repository<Deployment>,
  ) {}

  verifySignature(
    rawPayload: string | Buffer,
    signatureHeader: string | undefined,
    secret: string,
  ): boolean {
    if (!signatureHeader || !secret) {
      return false;
    }

    const [prefix, signature] = signatureHeader.split('=');
    if (prefix !== 'sha256' || !signature) {
      return false;
    }

    const hmac = createHmac('sha256', secret);
    hmac.update(rawPayload);
    const expectedSignature = hmac.digest('hex');

    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  async processPushEvent(
    payload: GitHubPushPayload,
    deliveryId?: string,
  ): Promise<EnqueueResult> {
    const branch = payload.ref.replace('refs/heads/', '');
    const commitSha = payload.after;
    const commitMessage =
      payload.head_commit?.message ||
      payload.commits?.[0]?.message ||
      'No commit message';
    const author = payload.pusher?.name || payload.sender?.login || 'unknown';
    const repositoryName = payload.repository.full_name;

    let project: Project | null = null;
    let deployment: Deployment | null = null;

    if (this.projectRepository) {
      project = await this.projectRepository.findOne({
        where: { repositoryName },
      });

      if (!project) {
        this.logger.warn(
          `Push event ignorado: No existe ningún proyecto registrado para el repositorio "${repositoryName}".`,
        );
        return {
          queued: false,
          repository: repositoryName,
          branch,
          commitSha,
          reason: `No project registered for repository "${repositoryName}"`,
        };
      }

      if (project.branch && project.branch !== branch) {
        this.logger.log(
          `Push event ignorado para "${repositoryName}": La rama recibida (${branch}) no coincide con la rama configurada (${project.branch}).`,
        );
        return {
          queued: false,
          projectId: project.id,
          repository: repositoryName,
          branch,
          commitSha,
          reason: `Push branch "${branch}" does not match project branch "${project.branch}"`,
        };
      }

      if (this.deploymentRepository) {
        const newDeployment = this.deploymentRepository.create({
          projectId: project.id,
          status: DeploymentStatus.QUEUED,
          commitSha,
          commitMessage,
          branch,
          startedAt: new Date(),
        });
        deployment = await this.deploymentRepository.save(newDeployment);
        this.logger.log(
          `Despliegue #${deployment.id} registrado con estado QUEUED para el proyecto "${project.name}" (${project.id}).`,
        );
      }
    }

    const jobData: DeploymentJobData = {
      deliveryId: deliveryId || randomUUID(),
      deploymentId: deployment?.id,
      projectId: project?.id,
      repositoryName,
      cloneUrl: payload.repository.clone_url,
      branch,
      commitSha,
      commitMessage,
      author,
      receivedAt: new Date().toISOString(),
    };

    const job = await this.deployQueue.add(DEPLOY_JOB, jobData, {
      jobId: jobData.deliveryId,
      removeOnComplete: true,
      attempts: 3,
    });

    this.logger.log(
      `Push event queued for ${jobData.repositoryName} (${branch}) - Job ID: ${job.id}${
        deployment ? ` - Deployment ID: ${deployment.id}` : ''
      }`,
    );

    return {
      queued: true,
      jobId: String(job.id),
      deploymentId: deployment?.id,
      projectId: project?.id,
      queue: DEPLOY_QUEUE,
      repository: jobData.repositoryName,
      branch,
      commitSha,
    };
  }
}
