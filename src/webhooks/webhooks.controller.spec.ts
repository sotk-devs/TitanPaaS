import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';
import { GitHubPushPayload } from './interfaces/github-payload.interface.js';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: jest.Mocked<Partial<WebhooksService>>;

  beforeEach(async () => {
    service = {
      processPushEvent: jest.fn().mockResolvedValue({
        queued: true,
        jobId: 'test-job-id',
        queue: 'deploy-queue',
        repository: 'org/repo',
        branch: 'main',
        commitSha: '123456',
      } as never),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleGitHubWebhook', () => {
    it('should throw BadRequestException if x-github-event is missing', async () => {
      await expect(
        controller.handleGitHubWebhook('', 'delivery-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle ping event successfully', async () => {
      const result = await controller.handleGitHubWebhook(
        'ping',
        'delivery-1',
        {
          hook_id: 12345,
        },
      );

      expect(result).toEqual({
        status: 'ok',
        event: 'ping',
        message: 'Pong! GitHub webhook received successfully.',
        hookId: 12345,
      });
      expect(service.processPushEvent).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid push payload structure', async () => {
      await expect(
        controller.handleGitHubWebhook('push', 'delivery-1', {
          ref: 'refs/heads/main',
          // missing repository.full_name
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.handleGitHubWebhook('push', 'delivery-1', {
          repository: { full_name: 'org/repo' },
          // missing ref
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process valid push event and delegate to service', async () => {
      const payload: GitHubPushPayload = {
        ref: 'refs/heads/main',
        before: '000000',
        after: 'abcdef',
        repository: {
          id: 1,
          name: 'repo',
          full_name: 'org/repo',
          clone_url: 'https://github.com/org/repo.git',
          html_url: 'https://github.com/org/repo',
          default_branch: 'main',
        },
      };

      const result = await controller.handleGitHubWebhook(
        'push',
        'delivery-1',
        payload as unknown as Record<string, unknown>,
      );

      expect(service.processPushEvent).toHaveBeenCalledWith(
        payload,
        'delivery-1',
      );
      expect(result).toEqual({
        queued: true,
        jobId: 'test-job-id',
        queue: 'deploy-queue',
        repository: 'org/repo',
        branch: 'main',
        commitSha: '123456',
      });
    });

    it('should return ignored status for unsupported events', async () => {
      const result = await controller.handleGitHubWebhook(
        'issues',
        'delivery-1',
        { action: 'opened' },
      );

      expect(result).toEqual({
        status: 'ignored',
        event: 'issues',
        message: "Event 'issues' acknowledged but ignored.",
      });
      expect(service.processPushEvent).not.toHaveBeenCalled();
    });
  });
});
