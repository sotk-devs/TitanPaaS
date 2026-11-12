import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { EncryptionService } from '../src/common/encryption/encryption.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { GithubAuthController } from '../src/auth/github-auth.controller.js';
import { GithubOAuthService } from '../src/auth/github-oauth.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { Project } from '../src/projects/entities/project.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { UsersService } from '../src/users/users.service.js';

describe('GithubAuthController (e2e)', () => {
  let app: INestApplication<App>;
  const userStore = new Map<string, User>();
  const projectStore: Project[] = [];
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const originalEnv = process.env;

  const mockResponse = (status: number, body: unknown): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'OK',
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as Response;

  const mockUsersService = {
    create: (data: any) => {
      const email = data.email.toLowerCase().trim();
      const user: User = {
        id: `user-${userStore.size + 1}`,
        email,
        password: data.password ?? null,
        name: data.name,
        githubId: data.githubId ?? null,
        githubUsername: data.githubUsername ?? null,
        avatarUrl: data.avatarUrl ?? null,
        githubAccessToken: data.githubAccessToken ?? null,
        projects: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userStore.set(email, user);
      return Promise.resolve(user);
    },
    findByEmail: (email: string) =>
      Promise.resolve(userStore.get(email.toLowerCase().trim()) || null),
    findByGithubId: (githubId: string) => {
      for (const u of userStore.values()) {
        if (u.githubId === githubId) return Promise.resolve(u);
      }
      return Promise.resolve(null);
    },
    findById: (id: string) => {
      for (const u of userStore.values()) {
        if (u.id === id) return Promise.resolve(u);
      }
      return Promise.resolve(null);
    },
    updateGithubProfile: (userId: string, data: any) => {
      for (const u of userStore.values()) {
        if (u.id === userId) {
          u.githubId = data.githubId;
          u.githubUsername = data.githubUsername;
          u.avatarUrl = data.avatarUrl;
          u.githubAccessToken = data.githubAccessToken;
          u.updatedAt = new Date();
          return Promise.resolve(u);
        }
      }
      return Promise.reject(new Error('User not found'));
    },
  };

  const mockProjectRepo = {
    find: ({ where }: any) =>
      Promise.resolve(projectStore.filter((p) => p.userId === where.userId)),
    create: (dto: any) => ({ ...dto }) as Project,
    save: (entity: any) => {
      const idx = projectStore.findIndex((p) => p.id === entity.id);
      if (idx >= 0) {
        projectStore[idx] = { ...entity };
        return Promise.resolve(projectStore[idx]);
      }
      const saved: Project = {
        ...entity,
        id: `proj-${projectStore.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      projectStore.push(saved);
      return Promise.resolve(saved);
    },
  };

  beforeAll(async () => {
    process.env = {
      ...originalEnv,
      GITHUB_CLIENT_ID: 'e2e-client-id',
      GITHUB_CLIENT_SECRET: 'e2e-client-secret',
      GITHUB_CALLBACK_URL: 'http://localhost:3000/auth/github/callback',
      GITHUB_AUTO_LINK_REPOS: 'true',
      GITHUB_WEBHOOK_SECRET: 'whsec-e2e',
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret:
            process.env.JWT_SECRET || 'titan_paas_secret_key_change_in_prod',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [AuthController, GithubAuthController],
      providers: [
        AuthService,
        GithubOAuthService,
        EncryptionService,
        JwtStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
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
  });

  beforeEach(() => {
    userStore.clear();
    projectStore.length = 0;

    fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/login/oauth/access_token')) {
          return mockResponse(200, { access_token: 'gho_e2e_token' });
        }
        if (url.endsWith('/user')) {
          return mockResponse(200, {
            id: 4242,
            login: 'octocat',
            name: 'Octo Cat',
            email: 'octocat@github.com',
            avatar_url: 'https://avatars.githubusercontent.com/u/4242',
          });
        }
        if (url.includes('/user/repos')) {
          return mockResponse(200, [
            {
              id: 8001,
              name: 'titan-demo',
              full_name: 'octocat/titan-demo',
              html_url: 'https://github.com/octocat/titan-demo',
              clone_url: 'https://github.com/octocat/titan-demo.git',
              default_branch: 'main',
              private: false,
              fork: false,
              archived: false,
              description: 'Demo app',
              owner: { login: 'octocat' },
            },
            {
              id: 8002,
              name: 'manual-only',
              full_name: 'some-org/manual-only',
              html_url: 'https://github.com/some-org/manual-only',
              clone_url: 'https://github.com/some-org/manual-only.git',
              default_branch: 'develop',
              private: true,
              fork: false,
              archived: false,
              description: 'Org repo',
              owner: { login: 'some-org' },
            },
          ]);
        }
        if (url.endsWith('/hooks')) {
          return mockResponse(201, { id: 99 });
        }
        return mockResponse(404, {});
      });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  afterAll(async () => {
    process.env = originalEnv;
    await app.close();
  });

  it('GET /auth/github?format=json should return GitHub authorization URL and state', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/github?format=json')
      .expect(200);

    expect(res.body.authorizationUrl).toContain(
      'https://github.com/login/oauth/authorize',
    );
    expect(res.body.state).toBeDefined();
  });

  it('GET /auth/github should reject untrusted redirectUri', async () => {
    await request(app.getHttpServer())
      .get('/auth/github?format=json&redirectUri=https://evil.attacker.com')
      .expect(400);
  });

  it('should authenticate via GitHub callback, auto-link owned repo, list repos, and manually link org repo', async () => {
    const authRes = await request(app.getHttpServer())
      .get('/auth/github?format=json')
      .expect(200);

    const callbackRes = await request(app.getHttpServer())
      .get(
        `/auth/github/callback?code=oauth-code-1&state=${authRes.body.state}`,
      )
      .expect(200);

    expect(callbackRes.body.access_token).toBeDefined();
    expect(callbackRes.body.user.githubUsername).toBe('octocat');
    expect(callbackRes.body.github.autoLinkedCount).toBe(1);
    expect(callbackRes.body.github.linkedRepositories[0].repositoryName).toBe(
      'octocat/titan-demo',
    );

    const token = callbackRes.body.access_token as string;

    const profileRes = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(profileRes.body.githubConnected).toBe(true);
    expect(profileRes.body.githubUsername).toBe('octocat');

    const reposRes = await request(app.getHttpServer())
      .get('/auth/github/repositories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(reposRes.body).toHaveLength(2);
    expect(reposRes.body[0].isLinked).toBe(true);
    expect(reposRes.body[1].isLinked).toBe(false);

    const linkRes = await request(app.getHttpServer())
      .post('/auth/github/repositories/link')
      .set('Authorization', `Bearer ${token}`)
      .send({
        repositories: ['some-org/manual-only'],
        configureWebhook: true,
        webhookUrl: 'https://paas.example.com/webhooks/github',
      })
      .expect(200);

    expect(linkRes.body.linkedCount).toBe(1);
    expect(linkRes.body.repositories[0]).toMatchObject({
      repositoryName: 'some-org/manual-only',
      action: 'created',
      webhookConfigured: true,
    });

    await request(app.getHttpServer())
      .delete('/auth/github/unlink')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('POST /auth/github/exchange should authenticate and unlink cleanly when user has local password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'octocat@github.com',
        password: 'localPassword123',
        name: 'Local Octo',
      })
      .expect(201);

    const exchangeRes = await request(app.getHttpServer())
      .post('/auth/github/exchange')
      .send({ code: 'spa-code-1', autoLink: false })
      .expect(200);

    expect(exchangeRes.body.github.isNewUser).toBe(false);
    expect(exchangeRes.body.github.autoLinkedCount).toBe(0);

    await request(app.getHttpServer())
      .delete('/auth/github/unlink')
      .set('Authorization', `Bearer ${exchangeRes.body.access_token}`)
      .expect(200);
  });
});
