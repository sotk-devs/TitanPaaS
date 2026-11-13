import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from './../src/app.module.js';
import { DEPLOY_QUEUE } from './../src/webhooks/webhooks.constants.js';
import {
  setupSwagger,
  SWAGGER_TAGS,
} from './../src/common/swagger/swagger.config.js';

describe('OpenAPI / Swagger Documentation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getQueueToken(DEPLOY_QUEUE))
      .useValue({
        add: () => Promise.resolve({ id: 'dummy' }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /docs should serve the Swagger UI HTML page', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .expect(200);

    expect(response.text).toContain('TitanPaaS API Docs');
    expect(response.text).toContain('swagger-ui');
  });

  it('GET /api/docs should also serve Swagger UI for backward compatibility', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs')
      .expect(200);

    expect(response.text).toContain('swagger-ui');
  });

  it('GET /docs/json should publish a complete OpenAPI 3.0 spec with all tags, paths, and schemas', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs/json')
      .expect(200);

    const spec = response.body;
    expect(spec.openapi).toMatch(/^3\.0\./);
    expect(spec.info.title).toBe('TitanPaaS API');
    expect(spec.info.version).toBe('1.0.0');

    // Verify Bearer JWT and API Key security schemes
    expect(spec.components?.securitySchemes?.bearer).toBeDefined();
    expect(spec.components.securitySchemes.bearer.type).toBe('http');
    expect(spec.components.securitySchemes.bearer.scheme).toBe('bearer');
    expect(spec.components?.securitySchemes?.['api-key']).toBeDefined();
    expect(spec.components.securitySchemes['api-key'].type).toBe('apiKey');
    expect(spec.components.securitySchemes['api-key'].name).toBe('X-API-Key');
    expect(spec.components.securitySchemes['api-key'].in).toBe('header');

    // Verify all platform tags are published
    const tagNames = (spec.tags ?? []).map((t: { name: string }) => t.name);
    for (const expectedTag of SWAGGER_TAGS) {
      expect(tagNames).toContain(expectedTag.name);
    }

    // Verify key endpoints loaded in test mode are documented
    expect(spec.paths['/']).toBeDefined();
    expect(spec.paths['/'].get.tags).toContain('System');

    expect(spec.paths['/webhooks/github']).toBeDefined();
    expect(spec.paths['/webhooks/github'].post.tags).toContain('Webhooks');
    expect(spec.paths['/webhooks/github'].post.responses['202']).toBeDefined();
    expect(spec.paths['/webhooks/github'].post.responses['400']).toBeDefined();
    expect(spec.paths['/webhooks/github'].post.responses['401']).toBeDefined();

    expect(spec.paths['/metrics/containers/{containerId}']).toBeDefined();
    expect(spec.paths['/metrics/containers/{containerId}'].get.tags).toContain(
      'Metrics',
    );
  });
});
