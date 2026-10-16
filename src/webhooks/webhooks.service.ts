import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { DEPLOY_JOB, DEPLOY_QUEUE } from './webhooks.constants.js';
import {
  DeploymentJobData,
  GitHubPushPayload,
} from './interfaces/github-payload.interface.js';

export interface EnqueueResult {
  queued: boolean;
  jobId: string;
  queue: string;
  repository: string;
  branch: string;
  commitSha: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectQueue(DEPLOY_QUEUE)
    private readonly deployQueue: Queue,
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

    const jobData: DeploymentJobData = {
      deliveryId: deliveryId || randomUUID(),
      repositoryName: payload.repository.full_name,
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
      `Push event queued for ${jobData.repositoryName} (${branch}) - Job ID: ${job.id}`,
    );

    return {
      queued: true,
      jobId: String(job.id),
      queue: DEPLOY_QUEUE,
      repository: jobData.repositoryName,
      branch,
      commitSha,
    };
  }
}
