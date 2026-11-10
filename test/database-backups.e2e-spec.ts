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
import { DatabaseBackupsController } from '../src/databases/controllers/database-backups.controller.js';
import { DatabaseBackupsService } from '../src/databases/services/database-backups.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';
import { DatabaseBackup } from '../src/databases/entities/database-backup.entity.js';
import { BackupSchedule } from '../src/databases/entities/backup-schedule.entity.js';
import { BackupStatus } from '../src/databases/enums/backup-status.enum.js';
import { BackupTrigger } from '../src/databases/enums/backup-trigger.enum.js';

describe('DatabaseBackupsController (e2e)', () => {
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
  const databaseId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
  const backupId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';

  const backupStore = new Map<string, DatabaseBackup>();
  let scheduleStore: BackupSchedule = {
    id: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    databaseId,
    cronExpression: '0 2 * * *',
    retentionDays: 7,
    isActive: true,
    lastRunAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    database: null as any,
  };

  const mockBackupsService = {
    createBackup: jest.fn((_userId: string, pid: string, did: string) => {
      const backup: DatabaseBackup = {
        id: backupId,
        databaseId: did,
        projectId: pid,
        fileName: 'backup_main-postgres_20261110.sql.gz',
        fileSize: 4096,
        storageKey: `backups/${pid}/${did}/backup_main-postgres_20261110.sql.gz`,
        storageBucket: 'titan-backups',
        status: BackupStatus.COMPLETED,
        trigger: BackupTrigger.MANUAL,
        errorMessage: null,
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        database: null as any,
      };
      backupStore.set(backupId, backup);
      return Promise.resolve(backup);
    }),
    findAllByDatabase: jest.fn((_userId: string, _pid: string, did: string) => {
      const list = Array.from(backupStore.values()).filter(
        (b) => b.databaseId === did,
      );
      return Promise.resolve(list);
    }),
    findOneBackup: jest.fn(
      (_userId: string, _pid: string, did: string, bid: string) => {
        const backup = backupStore.get(bid);
        if (!backup || backup.databaseId !== did) {
          throw new NotFoundException(`Respaldo #${bid} no encontrado`);
        }
        return Promise.resolve(backup);
      },
    ),
    restoreBackup: jest.fn(
      (_userId: string, _pid: string, did: string, bid: string) => {
        const backup = backupStore.get(bid);
        if (!backup || backup.databaseId !== did) {
          throw new NotFoundException(`Respaldo #${bid} no encontrado`);
        }
        return Promise.resolve({
          message: `Base de datos restaurada exitosamente desde el respaldo "${backup.fileName}"`,
          backup,
        });
      },
    ),
    deleteBackup: jest.fn(
      (_userId: string, _pid: string, did: string, bid: string) => {
        const backup = backupStore.get(bid);
        if (!backup || backup.databaseId !== did) {
          throw new NotFoundException(`Respaldo #${bid} no encontrado`);
        }
        backupStore.delete(bid);
        return Promise.resolve({
          message: `Respaldo "${backup.fileName}" eliminado exitosamente`,
        });
      },
    ),
    getSchedule: jest.fn(() => Promise.resolve(scheduleStore)),
    updateSchedule: jest.fn(
      (_userId: string, _pid: string, _did: string, dto: any) => {
        scheduleStore = {
          ...scheduleStore,
          ...dto,
        };
        return Promise.resolve(scheduleStore);
      },
    ),
    deleteSchedule: jest.fn(() => {
      scheduleStore.isActive = false;
      return Promise.resolve({
        message: 'Programacion eliminada exitosamente',
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
      controllers: [DatabaseBackupsController],
      providers: [
        JwtStrategy,
        {
          provide: DatabaseBackupsService,
          useValue: mockBackupsService,
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

  describe('POST /projects/:projectId/databases/:databaseId/backups', () => {
    it('should reject requests without authorization token (401)', async () => {
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/databases/${databaseId}/backups`)
        .expect(401);
    });

    it('should create a backup and upload to S3/MinIO (201)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/databases/${databaseId}/backups`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.id).toBe(backupId);
      expect(response.body.status).toBe(BackupStatus.COMPLETED);
      expect(response.body.storageBucket).toBe('titan-backups');
      expect(response.body.fileSize).toBe(4096);
    });
  });

  describe('GET /projects/:projectId/databases/:databaseId/backups', () => {
    it('should list all backups for the database (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/databases/${databaseId}/backups`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(backupId);
    });
  });

  describe('GET /projects/:projectId/databases/:databaseId/backups/:backupId', () => {
    it('should return backup details (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/projects/${projectId}/databases/${databaseId}/backups/${backupId}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(backupId);
      expect(response.body.fileName).toContain('backup_main-postgres_');
    });

    it('should return 404 if backup is not found', async () => {
      const nonexistentId = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';
      await request(app.getHttpServer())
        .get(
          `/projects/${projectId}/databases/${databaseId}/backups/${nonexistentId}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /projects/:projectId/databases/:databaseId/backups/:backupId/restore', () => {
    it('should restore database from backup with 1-click (200)', async () => {
      const response = await request(app.getHttpServer())
        .post(
          `/projects/${projectId}/databases/${databaseId}/backups/${backupId}/restore`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('restaurada exitosamente');
    });
  });

  describe('SCHEDULE management', () => {
    it('should get backup schedule configuration (200)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${projectId}/databases/${databaseId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.cronExpression).toBe('0 2 * * *');
      expect(response.body.retentionDays).toBe(7);
    });

    it('should reject invalid cron expression (400)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/projects/${projectId}/databases/${databaseId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ cronExpression: 'invalid-cron' })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringContaining('formato valido de 5 campos'),
        ]),
      );
    });

    it('should update backup schedule configuration (200)', async () => {
      const response = await request(app.getHttpServer())
        .put(`/projects/${projectId}/databases/${databaseId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ cronExpression: '0 4 * * *', retentionDays: 14 })
        .expect(200);

      expect(response.body.cronExpression).toBe('0 4 * * *');
      expect(response.body.retentionDays).toBe(14);
    });

    it('should delete or disable backup schedule (200)', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/projects/${projectId}/databases/${databaseId}/schedule`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('eliminada exitosamente');
    });
  });

  describe('DELETE /projects/:projectId/databases/:databaseId/backups/:backupId', () => {
    it('should delete backup from S3 and database (200)', async () => {
      const response = await request(app.getHttpServer())
        .delete(
          `/projects/${projectId}/databases/${databaseId}/backups/${backupId}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('eliminado exitosamente');

      await request(app.getHttpServer())
        .get(
          `/projects/${projectId}/databases/${databaseId}/backups/${backupId}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
