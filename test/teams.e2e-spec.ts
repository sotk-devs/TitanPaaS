import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { TeamsController } from '../src/teams/teams.controller.js';
import { TeamsService } from '../src/teams/teams.service.js';
import { TeamRolesGuard } from '../src/teams/guards/team-roles.guard.js';
import { TeamMember } from '../src/teams/entities/team-member.entity.js';
import { TeamRole } from '../src/teams/enums/team-role.enum.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';

describe('TeamsController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let ownerToken: string;
  let viewerToken: string;

  const ownerUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'owner@titanpaas.dev',
    name: 'Owner User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const viewerUser = {
    id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    email: 'viewer@titanpaas.dev',
    name: 'Viewer User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const teamId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
  const memberships = new Map<string, TeamMember>();

  const mockTeamMemberRepo = {
    findOne: jest.fn(
      ({ where }: { where: { teamId: string; userId: string } }) => {
        const m = memberships.get(`${where.teamId}:${where.userId}`);
        return Promise.resolve(m || null);
      },
    ),
  };

  const mockTeamsService = {
    create: jest.fn((userId: string, dto: any) => {
      memberships.set(`${teamId}:${userId}`, {
        id: 'm-owner',
        teamId,
        userId,
        role: TeamRole.OWNER,
      } as TeamMember);
      return Promise.resolve({
        id: teamId,
        name: dto.name,
        slug: dto.slug || 'core-team',
        description: dto.description || null,
        ownerId: userId,
        myRole: TeamRole.OWNER,
      });
    }),
    findAllForUser: jest.fn((userId: string) => {
      const list = Array.from(memberships.values()).filter(
        (m) => m.userId === userId,
      );
      return Promise.resolve(
        list.map((m) => ({ id: m.teamId, name: 'Core Team', myRole: m.role })),
      );
    }),
    findOne: jest.fn((userId: string, id: string) => {
      const m = memberships.get(`${id}:${userId}`);
      if (!m) throw new ForbiddenException();
      return Promise.resolve({
        id,
        name: 'Core Team',
        myRole: m.role,
        members: [],
      });
    }),
    update: jest.fn((_userId: string, id: string, dto: any) =>
      Promise.resolve({ id, ...dto }),
    ),
    remove: jest.fn(() =>
      Promise.resolve({ message: 'Equipo "Core Team" eliminado exitosamente' }),
    ),
    addMember: jest.fn((_userId: string, id: string, dto: any) => {
      memberships.set(`${id}:${viewerUser.id}`, {
        id: 'm-viewer',
        teamId: id,
        userId: viewerUser.id,
        role: dto.role,
      } as TeamMember);
      return Promise.resolve({
        id: 'm-viewer',
        teamId: id,
        userId: viewerUser.id,
        role: dto.role,
        user: {
          id: viewerUser.id,
          name: viewerUser.name,
          email: viewerUser.email,
        },
      });
    }),
    getMembers: jest.fn((_userId: string, id: string) =>
      Promise.resolve(
        Array.from(memberships.values()).filter((m) => m.teamId === id),
      ),
    ),
    updateMemberRole: jest.fn(
      (_userId: string, id: string, uid: string, dto: any) => {
        const m = memberships.get(`${id}:${uid}`);
        if (m) m.role = dto.role;
        return Promise.resolve(m);
      },
    ),
    removeMember: jest.fn((_userId: string, id: string, uid: string) => {
      memberships.delete(`${id}:${uid}`);
      return Promise.resolve({
        message: 'Miembro eliminado del equipo exitosamente',
      });
    }),
    getTeamProjects: jest.fn(() => Promise.resolve([])),
  };

  const mockUsersService = {
    findById: jest.fn((id: string) => {
      if (id === ownerUser.id) return Promise.resolve(ownerUser);
      if (id === viewerUser.id) return Promise.resolve(viewerUser);
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
      controllers: [TeamsController],
      providers: [
        JwtStrategy,
        TeamRolesGuard,
        {
          provide: getRepositoryToken(TeamMember),
          useValue: mockTeamMemberRepo,
        },
        {
          provide: TeamsService,
          useValue: mockTeamsService,
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
    ownerToken = jwtService.sign({
      sub: ownerUser.id,
      email: ownerUser.email,
    });
    viewerToken = jwtService.sign({
      sub: viewerUser.id,
      email: viewerUser.email,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /teams should return 401 without token', async () => {
    await request(app.getHttpServer()).get('/teams').expect(401);
  });

  it('POST /teams should create a new team', async () => {
    const res = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Core Team',
        slug: 'core-team',
        description: 'Main platform org',
      })
      .expect(201);

    expect(res.body.id).toBe(teamId);
    expect(res.body.myRole).toBe(TeamRole.OWNER);
  });

  it('POST /teams/:id/members should add a VIEWER member', async () => {
    const res = await request(app.getHttpServer())
      .post(`/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: viewerUser.email,
        role: TeamRole.VIEWER,
      })
      .expect(201);

    expect(res.body.role).toBe(TeamRole.VIEWER);
  });

  it('GET /teams/:id should allow VIEWER to read team', async () => {
    const res = await request(app.getHttpServer())
      .get(`/teams/${teamId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(res.body.myRole).toBe(TeamRole.VIEWER);
  });

  it('PATCH /teams/:id should return 403 Forbidden for VIEWER', async () => {
    await request(app.getHttpServer())
      .patch(`/teams/${teamId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Unauthorized Rename' })
      .expect(403);
  });

  it('DELETE /teams/:id should return 403 Forbidden for VIEWER', async () => {
    await request(app.getHttpServer())
      .delete(`/teams/${teamId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('PATCH /teams/:id/members/:userId should promote VIEWER to DEVELOPER', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/teams/${teamId}/members/${viewerUser.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: TeamRole.DEVELOPER })
      .expect(200);

    expect(res.body.role).toBe(TeamRole.DEVELOPER);
  });

  it('DELETE /teams/:id should allow OWNER to delete team', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/teams/${teamId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.message).toContain('eliminado exitosamente');
  });
});
