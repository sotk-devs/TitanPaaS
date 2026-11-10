import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { NotificationsService } from './notifications.service.js';
import { NotificationWebhook } from './entities/notification-webhook.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { NotificationProviderType } from './enums/notification-provider-type.enum.js';
import { NotificationEvent } from './enums/notification-event.enum.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let webhookRepo: jest.Mocked<Partial<Repository<NotificationWebhook>>>;
  let projectRepo: jest.Mocked<Partial<Repository<Project>>>;

  const originalFetch = global.fetch;

  const mockUserId = 'uuid-user-1';
  const mockProjectId = 'uuid-project-1';
  const mockWebhookId = 'uuid-webhook-1';

  const mockProject: Project = {
    id: mockProjectId,
    name: 'sample-project',
    repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
    repositoryName: 'sotk-devs/sample-repo',
    branch: 'main',
    port: 3000,
    envVariables: {},
    healthcheckPath: null,
    healthcheckExpectedStatus: 200,
    healthcheckTimeout: 5,
    healthcheckRetries: 3,
    userId: mockUserId,
    user: null as any,
    deployments: [],
    customDomains: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWebhook: NotificationWebhook = {
    id: mockWebhookId,
    projectId: mockProjectId,
    project: mockProject,
    name: 'Discord Alerts',
    type: NotificationProviderType.DISCORD,
    url: 'https://discord.com/api/webhooks/123/abc',
    events: [
      NotificationEvent.DEPLOY_STARTED,
      NotificationEvent.DEPLOY_SUCCEEDED,
      NotificationEvent.DEPLOY_FAILED,
    ],
    secret: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    webhookRepo = {
      create: jest.fn<any>().mockImplementation((dto: any) => ({ ...dto })),
      save: jest.fn<any>().mockImplementation((entity: any) =>
        Promise.resolve({
          ...mockWebhook,
          ...entity,
        }),
      ),
      find: jest.fn<any>(),
      findOne: jest.fn<any>(),
      remove: jest
        .fn<any>()
        .mockImplementation((entity: any) => Promise.resolve(entity)),
    };

    projectRepo = {
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(NotificationWebhook),
          useValue: webhookRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: projectRepo,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a webhook with default events if omitted', async () => {
      const result = await service.create(mockUserId, mockProjectId, {
        name: 'Discord Alerts',
        type: NotificationProviderType.DISCORD,
        url: 'https://discord.com/api/webhooks/123/abc',
      });

      expect(projectRepo.findOne).toHaveBeenCalledWith({
        where: { id: mockProjectId, userId: mockUserId },
      });
      expect(webhookRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: mockProjectId,
          name: 'Discord Alerts',
          type: NotificationProviderType.DISCORD,
          events: [
            NotificationEvent.DEPLOY_STARTED,
            NotificationEvent.DEPLOY_SUCCEEDED,
            NotificationEvent.DEPLOY_FAILED,
          ],
          isActive: true,
        }),
      );
      expect(result.id).toBe(mockWebhookId);
    });

    it('should throw NotFoundException if project does not exist or belong to user', async () => {
      (projectRepo.findOne as jest.Mock<any>).mockResolvedValue(null);

      await expect(
        service.create(mockUserId, mockProjectId, {
          name: 'Discord Alerts',
          type: NotificationProviderType.DISCORD,
          url: 'https://discord.com/api/webhooks/123/abc',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProject', () => {
    it('should return webhooks for owned project', async () => {
      (webhookRepo.find as jest.Mock<any>).mockResolvedValue([mockWebhook]);

      const result = await service.findByProject(mockUserId, mockProjectId);
      expect(result).toEqual([mockWebhook]);
      expect(webhookRepo.find).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('update & remove', () => {
    it('should update webhook fields', async () => {
      (webhookRepo.findOne as jest.Mock<any>).mockResolvedValue({
        ...mockWebhook,
      });

      const result = await service.update(
        mockUserId,
        mockProjectId,
        mockWebhookId,
        {
          isActive: false,
          name: 'Updated Name',
        },
      );

      expect(result.isActive).toBe(false);
      expect(result.name).toBe('Updated Name');
    });

    it('should remove webhook', async () => {
      (webhookRepo.findOne as jest.Mock<any>).mockResolvedValue(mockWebhook);

      const result = await service.remove(
        mockUserId,
        mockProjectId,
        mockWebhookId,
      );

      expect(webhookRepo.remove).toHaveBeenCalledWith(mockWebhook);
      expect(result.message).toContain('eliminado exitosamente');
    });

    it('should throw NotFoundException if webhook does not exist', async () => {
      (webhookRepo.findOne as jest.Mock<any>).mockResolvedValue(null);

      await expect(
        service.findOne(mockUserId, mockProjectId, 'missing-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('buildProviderPayload', () => {
    const basePayload = {
      event: NotificationEvent.DEPLOY_SUCCEEDED,
      projectId: mockProjectId,
      projectName: 'sample-project',
      repositoryName: 'sotk-devs/sample-repo',
      deploymentId: 'dep-1',
      branch: 'main',
      commitSha: 'a1b2c3d4e5f6',
      commitMessage: 'feat: add notifications',
      author: 'raul',
      url: 'http://sample-project.localhost',
      durationMs: 2500,
      timestamp: '2026-11-10T12:00:00.000Z',
    };

    it('should format Discord embeds payload', () => {
      const payload = service.buildProviderPayload(
        { ...mockWebhook, type: NotificationProviderType.DISCORD },
        basePayload,
      ) as any;

      expect(payload.username).toBe('TitanPaaS');
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0].color).toBe(3066993);
      expect(payload.embeds[0].title).toContain(
        'Despliegue completado exitosamente',
      );
    });

    it('should format Slack attachments payload', () => {
      const payload = service.buildProviderPayload(
        { ...mockWebhook, type: NotificationProviderType.SLACK },
        {
          ...basePayload,
          event: NotificationEvent.DEPLOY_FAILED,
          errorMessage: 'Build error',
        },
      ) as any;

      expect(payload.text).toContain('Despliegue fallido');
      expect(payload.attachments).toHaveLength(1);
      expect(payload.attachments[0].color).toBe('#e74c3c');
    });

    it('should format generic Webhook JSON payload', () => {
      const payload = service.buildProviderPayload(
        { ...mockWebhook, type: NotificationProviderType.WEBHOOK },
        basePayload,
      ) as any;

      expect(payload.event).toBe(NotificationEvent.DEPLOY_SUCCEEDED);
      expect(payload.project.name).toBe('sample-project');
      expect(payload.deployment.url).toBe('http://sample-project.localhost');
    });
  });

  describe('deliverToWebhook & notifyDeploymentEvent', () => {
    it('should sign generic webhook payload with HMAC-SHA256 when secret is set', async () => {
      global.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const signedWebhook: NotificationWebhook = {
        ...mockWebhook,
        type: NotificationProviderType.WEBHOOK,
        url: 'https://example.com/hook',
        secret: 'top-secret',
      };

      const payload = {
        event: NotificationEvent.DEPLOY_STARTED,
        projectId: mockProjectId,
        projectName: 'sample-project',
        repositoryName: 'sotk-devs/sample-repo',
        branch: 'main',
        commitSha: '1234567',
        timestamp: '2026-11-10T12:00:00.000Z',
      };

      const result = await service.deliverToWebhook(signedWebhook, payload);

      expect(result.delivered).toBe(true);
      expect(result.statusCode).toBe(200);

      const fetchCall = (global.fetch as jest.Mock<any>).mock.calls[0];
      const fetchInit = fetchCall[1] as {
        headers: Record<string, string>;
        body: string;
      };
      const expectedSig = createHmac('sha256', 'top-secret')
        .update(fetchInit.body)
        .digest('hex');

      expect(fetchInit.headers['X-TitanPaaS-Event']).toBe(
        NotificationEvent.DEPLOY_STARTED,
      );
      expect(fetchInit.headers['X-TitanPaaS-Signature']).toBe(
        `sha256=${expectedSig}`,
      );
    });

    it('should return delivered: false on HTTP error or network failure without throwing', async () => {
      global.fetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const res1 = await service.deliverToWebhook(mockWebhook, {
        event: NotificationEvent.DEPLOY_FAILED,
        projectId: mockProjectId,
        projectName: 'sample-project',
        repositoryName: 'sotk-devs/sample-repo',
        branch: 'main',
        commitSha: '1234567',
        errorMessage: 'Container exited',
        timestamp: '2026-11-10T12:00:00.000Z',
      });

      expect(res1.delivered).toBe(false);
      expect(res1.statusCode).toBe(500);

      global.fetch = jest
        .fn<any>()
        .mockRejectedValue(new Error('ECONNREFUSED'));

      const res2 = await service.deliverToWebhook(mockWebhook, {
        event: NotificationEvent.DEPLOY_STARTED,
        projectId: mockProjectId,
        projectName: 'sample-project',
        repositoryName: 'sotk-devs/sample-repo',
        branch: 'main',
        commitSha: '1234567',
        timestamp: '2026-11-10T12:00:00.000Z',
      });

      expect(res2.delivered).toBe(false);
      expect(res2.error).toContain('ECONNREFUSED');
    });

    it('should dispatch only to webhooks subscribed to the event', async () => {
      global.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 204,
      });

      const matchingWh: NotificationWebhook = {
        ...mockWebhook,
        id: 'wh-1',
        events: [NotificationEvent.DEPLOY_SUCCEEDED],
      };
      const nonMatchingWh: NotificationWebhook = {
        ...mockWebhook,
        id: 'wh-2',
        events: [NotificationEvent.DEPLOY_FAILED],
      };

      (webhookRepo.find as jest.Mock<any>).mockResolvedValue([
        matchingWh,
        nonMatchingWh,
      ]);

      const results = await service.notifyDeploymentEvent(
        NotificationEvent.DEPLOY_SUCCEEDED,
        {
          projectId: mockProjectId,
          projectName: 'sample-project',
          repositoryName: 'sotk-devs/sample-repo',
          branch: 'main',
          commitSha: 'abcdef1',
        },
      );

      expect(results).toHaveLength(1);
      expect(results[0].webhookId).toBe('wh-1');
      expect(results[0].delivered).toBe(true);
    });

    it('should send test notification via testWebhook', async () => {
      global.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        status: 200,
      });
      (webhookRepo.findOne as jest.Mock<any>).mockResolvedValue(mockWebhook);

      const res = await service.testWebhook(
        mockUserId,
        mockProjectId,
        mockWebhookId,
      );

      expect(res.delivered).toBe(true);
      expect(res.webhookId).toBe(mockWebhookId);
    });
  });
});
