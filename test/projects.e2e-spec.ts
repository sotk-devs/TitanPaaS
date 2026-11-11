import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProjectsController } from '../src/projects/projects.controller.js';
import { ProjectsService } from '../src/projects/projects.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';
import { Project } from '../src/projects/entities/project.entity.js';

describe('ProjectsController (e2e)', () => {
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

  const mockProjectStore = new Map<string, Project>();

  const mockProjectsService = {
    create: jest.fn((userId: string, dto: any) => {
      const id = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
      const project: Project = {
        id,
        name: dto.name,
        repositoryUrl: dto.repositoryUrl,
        repositoryName: dto.repositoryName,
        branch: dto.branch || 'main',
        port: dto.port || 3000,
        envVariables: dto.envVariables || {},
        healthcheckPath: dto.healthcheckPath || null,
        healthcheckExpectedStatus: dto.healthcheckExpectedStatus || 200,
        healthcheckTimeout: dto.healthcheckTimeout || 5,
        healthcheckRetries: dto.healthcheckRetries || 3,
        rateLimitEnabled: dto.rateLimitEnabled ?? false,
        rateLimitAverage: dto.rateLimitAverage ?? 100,
        rateLimitBurst: dto.rateLimitBurst ?? 50,
        rateLimitPeriod: dto.rateLimitPeriod ?? '1s',
        maxConcurrentConnections: dto.maxConcurrentConnections ?? null,
        userId,
        user: null as any,
        deployments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProjectStore.set(id, project);
      return Promise.resolve(project);
    }),
    findAll: jest.fn((userId: string) => {
      const list = Array.from(mockProjectStore.values()).filter(
        (p) => p.userId === userId,
      );
      return Promise.resolve(list);
    }),
    findOne: jest.fn((userId: string, id: string) => {
      const project = mockProjectStore.get(id);
      if (!project || project.userId !== userId) {
        const error = new Error(`Proyecto con ID "${id}" no encontrado`);
        (error as any).status = 404;
        throw error;
      }
      return Promise.resolve(project);
    }),
    update: jest.fn((userId: string, id: string, dto: any) => {
      const project = mockProjectStore.get(id);
      if (!project || project.userId !== userId) {
        const error = new Error(`Proyecto con ID "${id}" no encontrado`);
        (error as any).status = 404;
        throw error;
      }
      Object.assign(project, dto);
      return Promise.resolve(project);
    }),
    remove: jest.fn((userId: string, id: string) => {
      const project = mockProjectStore.get(id);
      if (!project || project.userId !== userId) {
        const error = new Error(`Proyecto con ID "${id}" no encontrado`);
        (error as any).status = 404;
        throw error;
      }
      mockProjectStore.delete(id);
      return Promise.resolve({
        message: `Proyecto "${project.name}" eliminado exitosamente`,
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
      controllers: [ProjectsController],
      providers: [
        JwtStrategy,
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
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

  it('GET /projects should return 401 when token is missing', async () => {
    await request(app.getHttpServer()).get('/projects').expect(401);
  });

  it('POST /projects should create a new project', async () => {
    const res = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'sample-project',
        repositoryUrl: 'https://github.com/sotk-devs/sample-repo.git',
        repositoryName: 'sotk-devs/sample-repo',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('sample-project');
    expect(res.body.branch).toBe('main');
    expect(res.body.port).toBe(3000);
  });

  it('GET /projects should return list of projects', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('sample-project');
  });

  it('GET /projects/:id should return single project details', async () => {
    const projectId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const res = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.id).toBe(projectId);
    expect(res.body.name).toBe('sample-project');
  });

  it('PATCH /projects/:id should update project', async () => {
    const projectId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'updated-project',
        port: 8080,
      })
      .expect(200);

    expect(res.body.name).toBe('updated-project');
    expect(res.body.port).toBe(8080);
  });

  describe('Rate Limiting & DDoS Protection', () => {
    const projectId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

    it('PATCH /projects/:id should reject invalid rateLimitAverage < 1 (400)', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rateLimitAverage: 0,
        })
        .expect(400);
    });

    it('PATCH /projects/:id should reject invalid rateLimitPeriod format (400)', async () => {
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rateLimitPeriod: 'invalid-period',
        })
        .expect(400);
    });

    it('PATCH /projects/:id should successfully configure rate limiting and ddos protection (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          rateLimitEnabled: true,
          rateLimitAverage: 200,
          rateLimitBurst: 100,
          rateLimitPeriod: '1s',
          maxConcurrentConnections: 50,
        })
        .expect(200);

      expect(res.body.rateLimitEnabled).toBe(true);
      expect(res.body.rateLimitAverage).toBe(200);
      expect(res.body.rateLimitBurst).toBe(100);
      expect(res.body.maxConcurrentConnections).toBe(50);
    });
  });

  it('DELETE /projects/:id should remove project', async () => {
    const projectId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    const res = await request(app.getHttpServer())
      .delete(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toContain('eliminado exitosamente');
  });
});
