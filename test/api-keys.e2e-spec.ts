import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  Controller,
  Get,
  INestApplication,
  Param,
  Post,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiKeysController } from '../src/api-keys/api-keys.controller.js';
import { ApiKeysService } from '../src/api-keys/api-keys.service.js';
import { ApiKey } from '../src/api-keys/entities/api-key.entity.js';
import { ApiKeyScope } from '../src/api-keys/enums/api-key-scope.enum.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { User } from '../src/users/entities/user.entity.js';
import { UsersService } from '../src/users/users.service.js';

@UseGuards(JwtAuthGuard)
@Controller('projects')
class MockProtectedProjectsController {
  @Get()
  list(@Request() req: { user: unknown }) {
    return { ok: true, user: req.user };
  }

  @Post()
  create() {
    return { created: true };
  }

  @Post(':id/deploy')
  deploy(@Param('id') id: string) {
    return { deployed: id };
  }
}

describe('ApiKeysController (e2e)', () => {
  let app: INestApplication<App>;
  const userStore = new Map<string, User>();
  let keyStore: ApiKey[] = [];

  const mockUsersService = {
    create: (data: any) => {
      const email = data.email.toLowerCase().trim();
      const user: User = {
        id: '11111111-1111-4111-8111-111111111111',
        email,
        password: data.password,
        name: data.name,
        projects: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userStore.set(email, user);
      return Promise.resolve(user);
    },
    findByEmail: (email: string) =>
      Promise.resolve(userStore.get(email.toLowerCase().trim()) || null),
    findById: (id: string) => {
      for (const u of userStore.values()) {
        if (u.id === id) return Promise.resolve(u);
      }
      return Promise.resolve(null);
    },
  };

  const mockApiKeyRepo = {
    create: (dto: any) => ({ ...dto }) as ApiKey,
    save: (entity: any) => {
      const idx = keyStore.findIndex((k) => k.id === entity.id);
      if (idx >= 0) {
        keyStore[idx] = { ...entity, updatedAt: new Date() };
        return Promise.resolve(keyStore[idx]);
      }
      const saved: ApiKey = {
        ...entity,
        id: `22222222-2222-4222-8222-22222222222${keyStore.length + 1}`,
        revokedAt: entity.revokedAt ?? null,
        lastUsedAt: entity.lastUsedAt ?? null,
        lastUsedIp: entity.lastUsedIp ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      keyStore.push(saved);
      return Promise.resolve(saved);
    },
    find: ({ where }: any) =>
      Promise.resolve(keyStore.filter((k) => k.userId === where.userId)),
    findOne: ({ where }: any) =>
      Promise.resolve(
        keyStore.find(
          (k) =>
            (!where.id || k.id === where.id) &&
            (!where.userId || k.userId === where.userId) &&
            (!where.keyHash || k.keyHash === where.keyHash),
        ) || null,
      ),
    remove: (entity: ApiKey) => {
      keyStore = keyStore.filter((k) => k.id !== entity.id);
      return Promise.resolve(entity);
    },
  };

  let jwtToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret:
            process.env.JWT_SECRET || 'titan_paas_secret_key_change_in_prod',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [
        AuthController,
        ApiKeysController,
        MockProtectedProjectsController,
      ],
      providers: [
        AuthService,
        ApiKeysService,
        JwtStrategy,
        JwtAuthGuard,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: mockApiKeyRepo,
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

    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'apikeys@titanpaas.dev',
        password: 'securePassword123',
        name: 'API Key Owner',
      })
      .expect(201);

    jwtToken = regRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create scoped API key, enforce permissions & project limits, rotate, and revoke', async () => {
    const allowedProjectId = '33333333-3333-4333-8333-333333333333';
    const otherProjectId = '44444444-4444-4444-8444-444444444444';

    const scopesRes = await request(app.getHttpServer())
      .get('/api-keys/scopes')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);
    expect(Array.isArray(scopesRes.body)).toBe(true);

    const createRes = await request(app.getHttpServer())
      .post('/api-keys')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({
        name: 'GitHub Actions Deploy',
        scopes: [ApiKeyScope.PROJECTS_READ, ApiKeyScope.DEPLOYMENTS_WRITE],
        allowedProjectIds: [allowedProjectId],
        expiresInDays: 30,
      })
      .expect(201);

    const apiKeyToken: string = createRes.body.token;
    const keyId: string = createRes.body.id;
    expect(apiKeyToken.startsWith('tp_live_')).toBe(true);

    // Allowed via X-API-Key header
    await request(app.getHttpServer())
      .get('/projects')
      .set('X-API-Key', apiKeyToken)
      .expect(200);

    // Allowed via Authorization: Bearer tp_live_... for allowed project deploy
    await request(app.getHttpServer())
      .post(`/projects/${allowedProjectId}/deploy`)
      .set('Authorization', `Bearer ${apiKeyToken}`)
      .expect(201);

    // Denied (403): missing projects:write scope
    await request(app.getHttpServer())
      .post('/projects')
      .set('X-API-Key', apiKeyToken)
      .expect(403);

    // Denied (403): project outside allowedProjectIds
    await request(app.getHttpServer())
      .post(`/projects/${otherProjectId}/deploy`)
      .set('X-API-Key', apiKeyToken)
      .expect(403);

    // Denied (403): cannot manage API keys without api-keys:manage
    await request(app.getHttpServer())
      .get('/api-keys')
      .set('X-API-Key', apiKeyToken)
      .expect(403);

    // Rotate key using JWT -> invalidates previous token
    const rotateRes = await request(app.getHttpServer())
      .post(`/api-keys/${keyId}/rotate`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    const rotatedToken: string = rotateRes.body.token;
    expect(rotatedToken).not.toBe(apiKeyToken);

    await request(app.getHttpServer())
      .get('/projects')
      .set('X-API-Key', apiKeyToken)
      .expect(401);

    await request(app.getHttpServer())
      .get('/projects')
      .set('X-API-Key', rotatedToken)
      .expect(200);

    // Revoke key -> 401 on subsequent requests
    await request(app.getHttpServer())
      .delete(`/api-keys/${keyId}`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/projects')
      .set('X-API-Key', rotatedToken)
      .expect(401);
  });
});
