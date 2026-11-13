import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { SystemController } from '../src/system/system.controller.js';
import { SystemService } from '../src/system/system.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';

describe('SystemController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let authToken: string;

  const mockUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'admin@titanpaas.local',
    name: 'Admin User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSystemService = {
    getHealth: jest.fn<any>().mockResolvedValue({
      status: 'healthy',
      timestamp: '2026-11-12T16:50:00.000Z',
      uptime: 500,
      services: {
        database: { status: 'up', latencyMs: 2 },
        redis: { status: 'up', latencyMs: 1 },
        docker: { status: 'up', latencyMs: 10 },
      },
    }),
    getDiagnostics: jest.fn<any>().mockResolvedValue({
      status: 'healthy',
      timestamp: '2026-11-12T16:50:00.000Z',
      host: {
        hostname: 'vps-prod-1',
        platform: 'linux',
        release: '6.1.0',
        arch: 'x64',
        cpus: { count: 8, model: 'AMD EPYC', speed: 3000 },
        loadAvg: [0.15, 0.2, 0.18],
        uptimeSeconds: 86400,
      },
      memory: {
        totalBytes: 34359738368,
        usedBytes: 8589934592,
        freeBytes: 25769803776,
        usagePercent: 25.0,
        formatted: { total: '32 GB', used: '8 GB', free: '24 GB' },
      },
      disk: {
        path: '.',
        totalBytes: 536870912000,
        usedBytes: 107374182400,
        freeBytes: 429496729600,
        availableBytes: 429496729600,
        usagePercent: 20.0,
        formatted: { total: '500 GB', used: '100 GB', free: '400 GB' },
      },
      services: {
        database: {
          status: 'up',
          latencyMs: 2,
          version: '16.1',
          database: 'titan_paas',
        },
        redis: { status: 'up', latencyMs: 1, host: 'localhost', port: 6379 },
        docker: {
          status: 'up',
          latencyMs: 10,
          version: '26.1.1',
          containers: { total: 5, running: 5, paused: 0, stopped: 0 },
        },
      },
    }),
  };

  const mockUsersService = {
    findById: jest.fn<any>().mockImplementation((id: string) => {
      if (id === mockUser.id) {
        return Promise.resolve(mockUser);
      }
      return Promise.resolve(null);
    }),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test_jwt_secret_for_e2e_testing';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [SystemController],
      providers: [
        {
          provide: SystemService,
          useValue: mockSystemService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        JwtStrategy,
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

  describe('GET /system/health', () => {
    it('should be publicly accessible without authentication and return 200', async () => {
      const response = await request(app.getHttpServer())
        .get('/system/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.services.database.status).toBe('up');
      expect(response.body.services.redis.status).toBe('up');
      expect(response.body.services.docker.status).toBe('up');
    });

    it('should return 503 when the cluster is unhealthy', async () => {
      mockSystemService.getHealth.mockResolvedValueOnce({
        status: 'unhealthy',
        timestamp: '2026-11-12T16:50:00.000Z',
        uptime: 500,
        services: {
          database: { status: 'down', message: 'Connection refused' },
          redis: { status: 'up' },
          docker: { status: 'up' },
        },
      });

      const response = await request(app.getHttpServer())
        .get('/system/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services.database.status).toBe('down');
    });
  });

  describe('GET /system/diagnostics', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      await request(app.getHttpServer()).get('/system/diagnostics').expect(401);
    });

    it('should return detailed cluster diagnostics when authenticated with JWT', async () => {
      const response = await request(app.getHttpServer())
        .get('/system/diagnostics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.host.hostname).toBe('vps-prod-1');
      expect(response.body.memory.totalBytes).toBeGreaterThan(0);
      expect(response.body.disk.path).toBe('.');
      expect(response.body.services.database.version).toBe('16.1');
      expect(response.body.services.docker.version).toBe('26.1.1');
    });
  });
});
