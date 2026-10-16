import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHmac } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { DEPLOY_QUEUE } from './../src/webhooks/webhooks.constants.js';

describe('WebhooksController (e2e)', () => {
  let app: INestApplication<App>;
  let mockQueue: { add: ReturnType<typeof jest.fn> };
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    mockQueue = {
      add: jest
        .fn()
        .mockImplementation((jobName: unknown, data: unknown) =>
          Promise.resolve({ id: 'test-job-e2e', name: jobName, data }),
        ),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getQueueToken(DEPLOY_QUEUE))
      .useValue(mockQueue)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await app.close();
  });

  it('POST /webhooks/github - returns 400 when x-github-event header is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks/github')
      .send({ some: 'data' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Missing x-github-event header');
  });

  it('POST /webhooks/github - handles ping event', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('x-github-event', 'ping')
      .send({
        zen: 'Approachable is better than simple.',
        hook_id: 98765,
      });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      status: 'ok',
      event: 'ping',
      message: 'Pong! GitHub webhook received successfully.',
      hookId: 98765,
    });
  });

  it('POST /webhooks/github - handles push event and enqueues deployment job', async () => {
    const pushPayload = {
      ref: 'refs/heads/main',
      before: '0000000000000000000000000000000000000000',
      after: 'a1b2c3d4e5f6789012345678901234567890abcd',
      repository: {
        id: 42,
        name: 'sample-project',
        full_name: 'test-org/sample-project',
        clone_url: 'https://github.com/test-org/sample-project.git',
        html_url: 'https://github.com/test-org/sample-project',
        default_branch: 'main',
      },
      pusher: {
        name: 'developer',
        email: 'developer@example.com',
      },
      head_commit: {
        id: 'a1b2c3d4e5f6789012345678901234567890abcd',
        message: 'feat: add deployment webhook',
        timestamp: '2026-10-14T12:00:00Z',
      },
    };

    const response = await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-uuid-42')
      .send(pushPayload);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      queued: true,
      jobId: 'test-job-e2e',
      queue: 'deploy-queue',
      repository: 'test-org/sample-project',
      branch: 'main',
      commitSha: 'a1b2c3d4e5f6789012345678901234567890abcd',
    });
    expect(mockQueue.add).toHaveBeenCalledTimes(1);
  });

  it('POST /webhooks/github - returns 400 when push payload is missing required fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('x-github-event', 'push')
      .send({ invalid: 'payload' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(
      'Invalid GitHub push payload structure',
    );
  });

  it('POST /webhooks/github - ignores unhandled events with 202', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks/github')
      .set('x-github-event', 'star')
      .send({ action: 'created' });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      status: 'ignored',
      event: 'star',
      message: "Event 'star' acknowledged but ignored.",
    });
  });

  describe('when GITHUB_WEBHOOK_SECRET is set', () => {
    const secret = 'super-secret-key-1234';

    beforeEach(() => {
      process.env.GITHUB_WEBHOOK_SECRET = secret;
    });

    it('returns 401 when signature header is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('x-github-event', 'ping')
        .send({ zen: 'Random text' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain(
        'Missing GitHub webhook signature',
      );
    });

    it('returns 401 when signature is invalid', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('x-github-event', 'ping')
        .set(
          'x-hub-signature-256',
          'sha256=invalidhex00000000000000000000000000000000000000000000000000000000',
        )
        .send({ zen: 'Random text' });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain(
        'Invalid GitHub webhook signature',
      );
    });

    it('returns 202 when signature is valid', async () => {
      const payloadString = JSON.stringify({
        zen: 'Keep it simple',
        hook_id: 111,
      });
      const hmac = createHmac('sha256', secret);
      hmac.update(payloadString);
      const signature = `sha256=${hmac.digest('hex')}`;

      const response = await request(app.getHttpServer())
        .post('/webhooks/github')
        .set('x-github-event', 'ping')
        .set('x-hub-signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(payloadString);

      expect(response.status).toBe(202);
      expect(response.body.event).toBe('ping');
    });
  });
});
