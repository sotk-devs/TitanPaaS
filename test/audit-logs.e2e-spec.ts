import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuditController } from '../src/audit/audit.controller.js';
import { AuditService } from '../src/audit/audit.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';
import { AuditAction } from '../src/audit/enums/audit-action.enum.js';
import { AuditResourceType } from '../src/audit/enums/audit-resource-type.enum.js';
import { AuditLog } from '../src/audit/entities/audit-log.entity.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('AuditController (e2e)', () => {
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
  const unauthorizedProjectId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

  const sampleAuditLogs: AuditLog[] = [
    {
      id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31',
      userId: mockUser.id,
      action: AuditAction.PROJECT_CREATE,
      resourceType: AuditResourceType.PROJECT,
      resourceId: projectId,
      projectId,
      details: { name: 'my-service', repository: 'sotk-devs/my-service' },
      ipAddress: '127.0.0.1',
      userAgent: 'Jest-Agent/1.0',
      createdAt: new Date('2026-11-13T10:00:00Z'),
    },
    {
      id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32',
      userId: mockUser.id,
      action: AuditAction.ENV_UPDATE,
      resourceType: AuditResourceType.ENVIRONMENT,
      resourceId: projectId,
      projectId,
      details: {
        action: 'env_variables_updated',
        keys: ['DATABASE_URL', 'PORT'],
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Jest-Agent/1.0',
      createdAt: new Date('2026-11-13T10:15:00Z'),
    },
  ];

  const mockAuditService = {
    findAll: jest.fn((userId: string, query: any) => {
      let filtered = [...sampleAuditLogs];
      if (query?.projectId) {
        if (query.projectId === unauthorizedProjectId) {
          throw new ForbiddenException(
            'No tienes permisos para consultar los registros de auditoria',
          );
        }
        filtered = filtered.filter((l) => l.projectId === query.projectId);
      }
      if (query?.action) {
        filtered = filtered.filter((l) => l.action === query.action);
      }
      return Promise.resolve({
        items: filtered,
        total: filtered.length,
        page: query?.page || 1,
        limit: query?.limit || 20,
        totalPages: 1,
      });
    }),
    findByProject: jest.fn((userId: string, pid: string, query: any) => {
      if (pid === unauthorizedProjectId) {
        throw new ForbiddenException(
          'No tienes permisos para acceder al proyecto',
        );
      }
      if (pid === '00000000-0000-0000-0000-000000000000') {
        throw new NotFoundException('Proyecto no encontrado');
      }
      return mockAuditService.findAll(userId, { ...query, projectId: pid });
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
      controllers: [AuditController],
      providers: [
        JwtStrategy,
        {
          provide: AuditService,
          useValue: mockAuditService,
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
        transform: true,
        transformOptions: { enableImplicitConversion: true },
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

  describe('GET /audit-logs', () => {
    it('should reject unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/audit-logs').expect(401);
    });

    it('should return 200 with paginated audit logs for authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page', 1);
      expect(res.body).toHaveProperty('limit', 20);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].action).toBe(AuditAction.PROJECT_CREATE);
    });

    it('should filter audit logs by action', async () => {
      const res = await request(app.getHttpServer())
        .get(`/audit-logs?action=${AuditAction.ENV_UPDATE}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].action).toBe(AuditAction.ENV_UPDATE);
      expect(res.body.items[0].details.keys).toContain('DATABASE_URL');
    });

    it('should return 403 when filtering by unauthorized projectId', async () => {
      await request(app.getHttpServer())
        .get(`/audit-logs?projectId=${unauthorizedProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('GET /projects/:projectId/audit-logs', () => {
    it('should return 200 with scoped audit logs for project owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/projects/${projectId}/audit-logs`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(2);
    });

    it('should return 400 when projectId is not a valid UUID', async () => {
      await request(app.getHttpServer())
        .get('/projects/invalid-uuid-format/audit-logs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should return 403 when user does not have permission on the project', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${unauthorizedProjectId}/audit-logs`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });
});
