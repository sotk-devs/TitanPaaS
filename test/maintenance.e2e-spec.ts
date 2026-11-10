import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { MaintenanceController } from '../src/maintenance/maintenance.controller.js';
import { GarbageCollectorService } from '../src/maintenance/garbage-collector.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';

describe('MaintenanceController (e2e)', () => {
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

  const mockGarbageCollectorService = {
    runGarbageCollection: jest.fn<any>().mockResolvedValue({
      success: true,
      startedAt: '2026-11-10T12:00:00.000Z',
      finishedAt: '2026-11-10T12:00:01.500Z',
      durationMs: 1500,
      imagesDeletedCount: 5,
      containersDeletedCount: 2,
      volumesDeletedCount: 1,
      workspacesDeletedCount: 3,
      totalSpaceReclaimedBytes: 104857600,
      totalSpaceReclaimedFormatted: '100 MB',
      details: {
        docker: {
          images: {
            deleted: ['img1', 'img2'],
            spaceReclaimedBytes: 52428800,
            raw: '',
          },
          containers: {
            deleted: ['c1'],
            spaceReclaimedBytes: 10485760,
            raw: '',
          },
          volumes: { deleted: ['v1'], spaceReclaimedBytes: 10485760, raw: '' },
          totalSpaceReclaimedBytes: 73400320,
        },
        workspaces: {
          workspacesDeleted: ['repo1/sha1'],
          spaceReclaimedBytes: 31457280,
        },
      },
    }),
    getStatus: jest.fn<any>().mockReturnValue({
      isRunning: false,
      lastRun: null,
      scheduler: {
        enabled: true,
        cronExpression: '0 3 * * *',
      },
    }),
  };

  const mockUsersService = {
    findById: jest.fn<any>().mockResolvedValue(mockUser),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'titan_paas_secret_key_change_in_prod',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [MaintenanceController],
      providers: [
        JwtStrategy,
        {
          provide: GarbageCollectorService,
          useValue: mockGarbageCollectorService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
    authToken = jwtService.sign({
      sub: mockUser.id,
      email: mockUser.email,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /maintenance/gc/status', () => {
    it('should reject requests without authorization token (401)', async () => {
      await request(app.getHttpServer())
        .get('/maintenance/gc/status')
        .expect(401);
    });

    it('should return garbage collection status when authorized (200)', async () => {
      const response = await request(app.getHttpServer())
        .get('/maintenance/gc/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        isRunning: false,
        lastRun: null,
        scheduler: {
          enabled: true,
          cronExpression: '0 3 * * *',
        },
      });
    });
  });

  describe('POST /maintenance/gc', () => {
    it('should reject requests without authorization token (401)', async () => {
      await request(app.getHttpServer())
        .post('/maintenance/gc')
        .send({ olderThanHours: 24 })
        .expect(401);
    });

    it('should reject invalid olderThanHours less than 1 (400)', async () => {
      const response = await request(app.getHttpServer())
        .post('/maintenance/gc')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ olderThanHours: 0 })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('El tiempo minimo es 1 hora'),
        ]),
      );
    });

    it('should execute on-demand garbage collection with valid parameters (200)', async () => {
      const response = await request(app.getHttpServer())
        .post('/maintenance/gc')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          olderThanHours: 48,
          pruneImages: true,
          pruneContainers: true,
          pruneVolumes: false,
          cleanWorkspaces: true,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.imagesDeletedCount).toBe(5);
      expect(response.body.totalSpaceReclaimedFormatted).toBe('100 MB');
      expect(
        mockGarbageCollectorService.runGarbageCollection,
      ).toHaveBeenCalledWith({
        olderThanHours: 48,
        pruneImages: true,
        pruneContainers: true,
        pruneVolumes: false,
        cleanWorkspaces: true,
      });
    });
  });
});
