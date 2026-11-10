import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { NotificationsController } from '../src/notifications/notifications.controller.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';
import { NotificationProviderType } from '../src/notifications/enums/notification-provider-type.enum.js';
import { NotificationEvent } from '../src/notifications/enums/notification-event.enum.js';
import { NotificationWebhook } from '../src/notifications/entities/notification-webhook.entity.js';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let authToken: string;

  const mockUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'developer@example.com',
    name: 'Dev User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const webhookId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  const mockWebhookStore = new Map<string, NotificationWebhook>();

  const mockNotificationsService = {
    create: jest.fn((_userId: string, pid: string, dto: any) => {
      const webhook: NotificationWebhook = {
        id: webhookId,
        projectId: pid,
        project: null as any,
        name: dto.name,
        type: dto.type,
        url: dto.url,
        events: dto.events || [
          NotificationEvent.DEPLOY_STARTED,
          NotificationEvent.DEPLOY_SUCCEEDED,
          NotificationEvent.DEPLOY_FAILED,
        ],
        secret: dto.secret || null,
        isActive: dto.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockWebhookStore.set(webhookId, webhook);
      return Promise.resolve(webhook);
    }),
    findByProject: jest.fn((_userId: string, pid: string) => {
      const list = Array.from(mockWebhookStore.values()).filter(
        (w) => w.projectId === pid,
      );
      return Promise.resolve(list);
    }),
    update: jest.fn((_userId: string, _pid: string, id: string, dto: any) => {
      const webhook = mockWebhookStore.get(id);
      if (!webhook) {
        const error = new Error(`Webhook #${id} no encontrado`);
        (error as any).status = 404;
        throw error;
      }
      Object.assign(webhook, dto);
      return Promise.resolve(webhook);
    }),
    remove: jest.fn((_userId: string, _pid: string, id: string) => {
      const webhook = mockWebhookStore.get(id);
      if (!webhook) {
        const error = new Error(`Webhook #${id} no encontrado`);
        (error as any).status = 404;
        throw error;
      }
      mockWebhookStore.delete(id);
      return Promise.resolve({
        message: `Webhook "${webhook.name}" eliminado exitosamente`,
      });
    }),
    testWebhook: jest.fn((_userId: string, _pid: string, id: string) => {
      return Promise.resolve({
        webhookId: id,
        delivered: true,
        statusCode: 204,
      });
    }),
  };

  const mockUsersService = {
    findById: jest.fn((id: string) => {
      if (id === mockUser.id) return Promise.resolve(mockUser);
      return Promise.resolve(null);
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'titan_paas_secret_key_change_in_prod',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [NotificationsController],
      providers: [
        JwtStrategy,
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    authToken = jwtService.sign({
      sub: mockUser.id,
      email: mockUser.email,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /projects/:projectId/notifications should return 401 without token', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/notifications`)
      .expect(401);
  });

  it('POST /projects/:projectId/notifications should reject invalid URL', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/notifications`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Bad Webhook',
        type: NotificationProviderType.DISCORD,
        url: 'not-a-valid-url',
      })
      .expect(400);
  });

  it('POST /projects/:projectId/notifications should register a webhook', async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/notifications`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Discord #deploys',
        type: NotificationProviderType.DISCORD,
        url: 'https://discord.com/api/webhooks/123456/abcdef',
        events: [
          NotificationEvent.DEPLOY_STARTED,
          NotificationEvent.DEPLOY_FAILED,
        ],
      })
      .expect(201);

    expect(res.body.id).toBe(webhookId);
    expect(res.body.type).toBe(NotificationProviderType.DISCORD);
    expect(res.body.events).toEqual([
      NotificationEvent.DEPLOY_STARTED,
      NotificationEvent.DEPLOY_FAILED,
    ]);
  });

  it('GET /projects/:projectId/notifications should list project webhooks', async () => {
    const res = await request(app.getHttpServer())
      .get(`/projects/${projectId}/notifications`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Discord #deploys');
  });

  it('PATCH /projects/:projectId/notifications/:id should update webhook', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/notifications/${webhookId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        isActive: false,
      })
      .expect(200);

    expect(res.body.isActive).toBe(false);
  });

  it('POST /projects/:projectId/notifications/:id/test should send test delivery', async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/notifications/${webhookId}/test`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.delivered).toBe(true);
    expect(res.body.statusCode).toBe(204);
  });

  it('DELETE /projects/:projectId/notifications/:id should delete webhook', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/projects/${projectId}/notifications/${webhookId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.message).toContain('eliminado exitosamente');
  });
});
