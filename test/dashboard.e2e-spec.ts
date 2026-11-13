import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from './../src/app.module.js';
import { DEPLOY_QUEUE } from './../src/webhooks/webhooks.constants.js';

describe('DashboardController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getQueueToken(DEPLOY_QUEUE))
      .useValue({
        add: () => Promise.resolve({ id: 'dummy-job' }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /dashboard should return 200 with text/html content-type and complete UI', async () => {
    const response = await request(app.getHttpServer())
      .get('/dashboard')
      .expect(200)
      .expect('Content-Type', /text\/html/);

    expect(response.text).toContain('<!DOCTYPE html>');
    expect(response.text).toContain('TitanPaaS');
    expect(response.text).toContain('Panel de Proyectos');
    expect(response.text).toContain('id="loginForm"');
    expect(response.text).toContain('id="registerForm"');
    expect(response.text).toContain('id="projectsContainer"');
    expect(response.text).toContain('id="metricsPanel"');
    expect(response.text).toContain('socket.io');
    expect(response.text).toContain('/metrics');
  });
});
