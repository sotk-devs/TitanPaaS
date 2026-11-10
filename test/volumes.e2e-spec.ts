import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { VolumesController } from '../src/volumes/volumes.controller.js';
import { VolumesService } from '../src/volumes/volumes.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';
import { ProjectVolume } from '../src/volumes/entities/project-volume.entity.js';

describe('VolumesController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let authToken: string;

  const mockUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'developer@titanpaas.local',
    name: 'Dev User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const projectId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  const volumeId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

  const volumeStore = new Map<string, ProjectVolume>();

  const mockVolumesService = {
    create: jest.fn((_userId: string, pid: string, dto: any) => {
      const volume: ProjectVolume = {
        id: volumeId,
        name: dto.name,
        volumeName: `titan_vol_repo_${dto.name}`,
        mountPath: dto.mountPath,
        readOnly: dto.readOnly ?? false,
        size: dto.size || null,
        projectId: pid,
        project: null as any,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      volumeStore.set(volumeId, volume);
      return Promise.resolve(volume);
    }),
    findAllByProject: jest.fn((_userId: string, pid: string) => {
      const list = Array.from(volumeStore.values()).filter(
        (v) => v.projectId === pid,
      );
      return Promise.resolve(list);
    }),
    findOne: jest.fn((_userId: string, _pid: string, id: string) => {
      const volume = volumeStore.get(id);
      if (!volume) {
        throw new NotFoundException(`Volumen #${id} no encontrado`);
      }
      return Promise.resolve(volume);
    }),
    update: jest.fn((_userId: string, _pid: string, id: string, dto: any) => {
      const volume = volumeStore.get(id);
      if (!volume) {
        throw new NotFoundException(`Volumen #${id} no encontrado`);
      }
      Object.assign(volume, dto);
      return Promise.resolve(volume);
    }),
    remove: jest.fn((_userId: string, _pid: string, id: string) => {
      const volume = volumeStore.get(id);
      if (!volume) {
        throw new NotFoundException(`Volumen #${id} no encontrado`);
      }
      volumeStore.delete(id);
      return Promise.resolve({
        message: `Volumen "${volume.name}" eliminado exitosamente`,
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
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'titan_paas_secret_key_change_in_prod',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [VolumesController],
      providers: [
        JwtStrategy,
        {
          provide: VolumesService,
          useValue: mockVolumesService,
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

  describe('POST /projects/:projectId/volumes', () => {
    it('should reject requests without authorization token (401)', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/volumes`)
        .send({ name: 'uploads', mountPath: '/app/uploads' })
        .expect(401);
    });

    it('should reject requests with invalid mount path format (400)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/volumes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'uploads', mountPath: 'relative/path' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'La ruta de montaje debe ser una ruta absoluta valida',
          ),
        ]),
      );
    });

    it('should successfully create a volume with valid payload (201)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/volumes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'uploads',
          mountPath: '/app/uploads',
          readOnly: false,
          size: '10GB',
        })
        .expect(201);

      expect(response.body.id).toBe(volumeId);
      expect(response.body.name).toBe('uploads');
      expect(response.body.mountPath).toBe('/app/uploads');
      expect(response.body.readOnly).toBe(false);
      expect(response.body.size).toBe('10GB');
    });
  });

  describe('GET /projects/:projectId/volumes', () => {
    it('should reject requests without authorization token (401)', async () => {
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/volumes`)
        .expect(401);
    });

    it('should list all volumes of the project (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/volumes`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('uploads');
    });
  });

  describe('GET /projects/:projectId/volumes/:id', () => {
    it('should return volume details (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/volumes/${volumeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(volumeId);
      expect(response.body.mountPath).toBe('/app/uploads');
    });

    it('should return 404 if volume is not found', async () => {
      const nonexistentId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/volumes/${nonexistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /projects/:projectId/volumes/:id', () => {
    it('should update volume configuration (200)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/volumes/${volumeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ readOnly: true, size: '20GB' })
        .expect(200);

      expect(response.body.readOnly).toBe(true);
      expect(response.body.size).toBe('20GB');
    });
  });

  describe('DELETE /projects/:projectId/volumes/:id', () => {
    it('should remove the volume (200)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/projects/${projectId}/volumes/${volumeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('eliminado exitosamente');

      // Verify deletion from store
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/volumes/${volumeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
