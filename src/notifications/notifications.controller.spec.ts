import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationProviderType } from './enums/notification-provider-type.enum.js';
import { NotificationEvent } from './enums/notification-event.enum.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: jest.Mocked<Partial<NotificationsService>>;

  const mockReq = {
    user: { id: 'uuid-user-1', email: 'dev@example.com', name: 'Dev' },
  };
  const projectId = 'uuid-project-1';
  const webhookId = 'uuid-webhook-1';

  beforeEach(async () => {
    service = {
      create: jest.fn<any>(),
      findByProject: jest.fn<any>(),
      update: jest.fn<any>(),
      remove: jest.fn<any>(),
      testWebhook: jest.fn<any>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a webhook', async () => {
    const dto = {
      name: 'Slack Alerts',
      type: NotificationProviderType.SLACK,
      url: 'https://hooks.slack.com/services/T00/B00/XX',
      events: [NotificationEvent.DEPLOY_FAILED],
    };
    (service.create as jest.Mock<any>).mockResolvedValue({
      id: webhookId,
      ...dto,
    });

    const res = await controller.create(mockReq, projectId, dto);
    expect(service.create).toHaveBeenCalledWith(
      mockReq.user.id,
      projectId,
      dto,
    );
    expect(res.id).toBe(webhookId);
  });

  it('should list webhooks for a project', async () => {
    (service.findByProject as jest.Mock<any>).mockResolvedValue([]);
    const res = await controller.findAll(mockReq, projectId);
    expect(service.findByProject).toHaveBeenCalledWith(
      mockReq.user.id,
      projectId,
    );
    expect(res).toEqual([]);
  });

  it('should update a webhook', async () => {
    (service.update as jest.Mock<any>).mockResolvedValue({ id: webhookId });
    const dto = { isActive: false };
    const res = await controller.update(mockReq, projectId, webhookId, dto);
    expect(service.update).toHaveBeenCalledWith(
      mockReq.user.id,
      projectId,
      webhookId,
      dto,
    );
    expect(res.id).toBe(webhookId);
  });

  it('should delete a webhook', async () => {
    (service.remove as jest.Mock<any>).mockResolvedValue({
      message: 'deleted',
    });
    const res = await controller.remove(mockReq, projectId, webhookId);
    expect(service.remove).toHaveBeenCalledWith(
      mockReq.user.id,
      projectId,
      webhookId,
    );
    expect(res.message).toBe('deleted');
  });

  it('should test a webhook', async () => {
    (service.testWebhook as jest.Mock<any>).mockResolvedValue({
      webhookId,
      delivered: true,
      statusCode: 200,
    });
    const res = await controller.test(mockReq, projectId, webhookId);
    expect(service.testWebhook).toHaveBeenCalledWith(
      mockReq.user.id,
      projectId,
      webhookId,
    );
    expect(res.delivered).toBe(true);
  });
});
