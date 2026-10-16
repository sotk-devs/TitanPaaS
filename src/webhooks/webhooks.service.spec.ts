import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { createHmac } from 'node:crypto';
import { Queue } from 'bullmq';
import { WebhooksService } from './webhooks.service.js';
import { DEPLOY_JOB, DEPLOY_QUEUE } from './webhooks.constants.js';
import { GitHubPushPayload } from './interfaces/github-payload.interface.js';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let mockQueue: jest.Mocked<Partial<Queue>>;

  beforeEach(() => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'test-job-id' } as never),
    };

    service = new WebhooksService(mockQueue as unknown as Queue);
  });

  describe('verifySignature', () => {
    const secret = 'my-webhook-secret';
    const payload = JSON.stringify({ ref: 'refs/heads/main' });

    it('should return true for valid sha256 signature', () => {
      const hmac = createHmac('sha256', secret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      const isValid = service.verifySignature(payload, signature, secret);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const isValid = service.verifySignature(
        payload,
        'sha256=invalidhexsignature000000000000000000000000000000000000000000000000',
        secret,
      );
      expect(isValid).toBe(false);
    });

    it('should return false when signature header is missing or secret is empty', () => {
      expect(service.verifySignature(payload, undefined, secret)).toBe(false);
      expect(service.verifySignature(payload, 'sha256=abc', '')).toBe(false);
    });
  });

  describe('processPushEvent', () => {
    it('should extract push event data and enqueue deployment job', async () => {
      const pushPayload: GitHubPushPayload = {
        ref: 'refs/heads/main',
        before: '0000000',
        after: 'abcdef1234567890',
        repository: {
          id: 1,
          name: 'my-app',
          full_name: 'org/my-app',
          clone_url: 'https://github.com/org/my-app.git',
          html_url: 'https://github.com/org/my-app',
          default_branch: 'main',
        },
        pusher: {
          name: 'octocat',
          email: 'octocat@github.com',
        },
        head_commit: {
          id: 'abcdef1234567890',
          message: 'feat: add awesome feature',
          timestamp: '2026-10-14T10:00:00Z',
        },
      };

      const result = await service.processPushEvent(
        pushPayload,
        'delivery-123',
      );

      expect(result).toEqual({
        queued: true,
        jobId: 'test-job-id',
        queue: DEPLOY_QUEUE,
        repository: 'org/my-app',
        branch: 'main',
        commitSha: 'abcdef1234567890',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        DEPLOY_JOB,
        expect.objectContaining({
          deliveryId: 'delivery-123',
          repositoryName: 'org/my-app',
          cloneUrl: 'https://github.com/org/my-app.git',
          branch: 'main',
          commitSha: 'abcdef1234567890',
          commitMessage: 'feat: add awesome feature',
          author: 'octocat',
        }),
        expect.objectContaining({
          jobId: 'delivery-123',
          removeOnComplete: true,
          attempts: 3,
        }),
      );
    });
  });
});
