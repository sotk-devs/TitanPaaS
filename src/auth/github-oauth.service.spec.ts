import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { EncryptionService } from '../common/encryption/encryption.service.js';
import { Project } from '../projects/entities/project.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { GithubOAuthService } from './github-oauth.service.js';

describe('GithubOAuthService', () => {
  let service: GithubOAuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let authService: jest.Mocked<Partial<AuthService>>;
  let encryptionService: EncryptionService;
  let projectRepository: jest.Mocked<Partial<Repository<Project>>>;
  let userStore: Map<string, User>;
  let projectStore: Project[];
  let teamStore: any[];
  let teamMemberStore: any[];
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  const originalEnv = process.env;

  const makeMockResponse = (status: number, body: unknown): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: async () => body,
      text: async () => JSON.stringify(body),
    }) as Response;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GITHUB_CLIENT_ID: 'test-client-id',
      GITHUB_CLIENT_SECRET: 'test-client-secret',
      GITHUB_CALLBACK_URL: 'http://localhost:3000/auth/github/callback',
      GITHUB_AUTO_LINK_REPOS: 'true',
      GITHUB_AUTO_LINK_LIMIT: '20',
      JWT_SECRET: 'test-jwt-secret',
    };

    userStore = new Map<string, User>();
    projectStore = [];
    teamStore = [];
    teamMemberStore = [];
    encryptionService = new EncryptionService();

    usersService = {
      findByGithubId: jest.fn(async (githubId: string) => {
        for (const u of userStore.values()) {
          if (u.githubId === githubId) return u;
        }
        return null;
      }),
      findByEmail: jest.fn(async (email: string) => {
        return userStore.get(email.toLowerCase().trim()) || null;
      }),
      findById: jest.fn(async (id: string) => {
        for (const u of userStore.values()) {
          if (u.id === id) return u;
        }
        return null;
      }),
      create: jest.fn(async (data: any) => {
        const user: User = {
          id: `user-${userStore.size + 1}`,
          email: data.email.toLowerCase().trim(),
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
        userStore.set(user.email, user);
        return user;
      }),
      updateGithubProfile: jest.fn(async (userId: string, data: any) => {
        for (const u of userStore.values()) {
          if (u.id === userId) {
            u.githubId = data.githubId;
            u.githubUsername = data.githubUsername;
            u.avatarUrl = data.avatarUrl;
            u.githubAccessToken = data.githubAccessToken;
            u.updatedAt = new Date();
            return u;
          }
        }
        throw new Error('User not found');
      }),
    };

    authService = {
      buildAuthResponse: jest.fn(async (user: User) => ({
        access_token: `jwt-for-${user.id}`,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          githubId: user.githubId ?? null,
          githubUsername: user.githubUsername ?? null,
          avatarUrl: user.avatarUrl ?? null,
          githubConnected: Boolean(user.githubId),
          createdAt: user.createdAt,
        },
      })),
    };

    projectRepository = {
      find: jest.fn(async ({ where }: any) =>
        projectStore.filter((p) => p.userId === where.userId),
      ),
      create: jest.fn((dto: any) => ({ ...dto }) as Project),
      save: jest.fn(async (entity: any) => {
        const existingIndex = projectStore.findIndex((p) => p.id === entity.id);
        if (existingIndex >= 0) {
          projectStore[existingIndex] = { ...entity };
          return projectStore[existingIndex];
        }
        const saved: Project = {
          ...entity,
          id: `proj-${projectStore.length + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        projectStore.push(saved);
        return saved;
      }),
    };

    const teamRepository = {
      findOne: jest.fn(
        async ({ where }: any) =>
          teamStore.find((t) => t.slug === where.slug) || null,
      ),
      create: jest.fn((dto: any) => ({
        ...dto,
        id: `team-${teamStore.length + 1}`,
      })),
      save: jest.fn(async (entity: any) => {
        teamStore.push(entity);
        return entity;
      }),
    };

    const teamMemberRepository = {
      findOne: jest.fn(
        async ({ where }: any) =>
          teamMemberStore.find(
            (m) => m.teamId === where.teamId && m.userId === where.userId,
          ) || null,
      ),
      create: jest.fn((dto: any) => ({
        ...dto,
        id: `tm-${teamMemberStore.length + 1}`,
      })),
      save: jest.fn(async (entity: any) => {
        teamMemberStore.push(entity);
        return entity;
      }),
    };

    fetchSpy = jest.spyOn(globalThis, 'fetch');

    service = new GithubOAuthService(
      usersService as unknown as UsersService,
      authService as unknown as AuthService,
      encryptionService,
      projectRepository as unknown as Repository<Project>,
      teamRepository as any,
      teamMemberRepository as any,
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = originalEnv;
  });

  describe('authorization URL & state validation', () => {
    it('should throw ServiceUnavailableException when GITHUB_CLIENT_ID is missing', () => {
      delete process.env.GITHUB_CLIENT_ID;
      expect(() => service.getAuthorizationUrl()).toThrow(
        ServiceUnavailableException,
      );
    });

    it('should build authorization URL and verifiable signed state', () => {
      const { authorizationUrl, state } = service.getAuthorizationUrl({
        autoLink: true,
        redirectUri: 'http://localhost:5173/callback',
      });

      const url = new URL(authorizationUrl);
      expect(url.origin + url.pathname).toBe(
        'https://github.com/login/oauth/authorize',
      );
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('state')).toBe(state);

      const verified = service.verifyState(state);
      expect(verified.autoLink).toBe(true);
      expect(verified.redirectUri).toBe('http://localhost:5173/callback');
    });

    it('should reject disallowed redirectUri origins to prevent open redirect', () => {
      expect(() =>
        service.getAuthorizationUrl({
          redirectUri: 'https://evil.example.com',
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject tampered or malformed OAuth state', () => {
      const state = service.generateState();
      expect(() => service.verifyState(`${state}tampered`)).toThrow(
        UnauthorizedException,
      );
      expect(() => service.verifyState('malformed')).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('authenticateWithCode', () => {
    it('should register new user, encrypt token, and auto-link owned non-fork repos', async () => {
      fetchSpy.mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/login/oauth/access_token')) {
          return makeMockResponse(200, { access_token: 'gho_secret_token' });
        }
        if (url.endsWith('/user')) {
          return makeMockResponse(200, {
            id: 98765,
            login: 'raaulgal09',
            name: 'Raul Garcia',
            email: null,
            avatar_url: 'https://avatars.githubusercontent.com/u/98765',
          });
        }
        if (url.endsWith('/user/emails')) {
          return makeMockResponse(200, [
            { email: 'secondary@test.dev', primary: false, verified: true },
            { email: 'raul@titanpaas.dev', primary: true, verified: true },
          ]);
        }
        if (url.includes('/user/repos')) {
          return makeMockResponse(200, [
            {
              id: 101,
              name: 'my-api',
              full_name: 'raaulgal09/my-api',
              html_url: 'https://github.com/raaulgal09/my-api',
              clone_url: 'https://github.com/raaulgal09/my-api.git',
              default_branch: 'main',
              private: true,
              fork: false,
              archived: false,
              description: 'Backend API',
              owner: { login: 'raaulgal09' },
            },
            {
              id: 102,
              name: 'forked-repo',
              full_name: 'raaulgal09/forked-repo',
              html_url: 'https://github.com/raaulgal09/forked-repo',
              clone_url: 'https://github.com/raaulgal09/forked-repo.git',
              default_branch: 'main',
              private: false,
              fork: true,
              archived: false,
              description: null,
              owner: { login: 'raaulgal09' },
            },
          ]);
        }
        return makeMockResponse(404, {});
      });

      const state = service.generateState({ autoLink: true });
      const result = await service.authenticateWithCode('valid-code', state);

      expect(result.access_token).toBe('jwt-for-user-1');
      expect(result.user.email).toBe('raul@titanpaas.dev');
      expect(result.user.githubUsername).toBe('raaulgal09');
      expect(result.github.isNewUser).toBe(true);
      expect(result.github.autoLinkedCount).toBe(1);
      expect(result.github.linkedRepositories).toHaveLength(1);
      expect(result.github.linkedRepositories[0]).toMatchObject({
        name: 'my-api',
        repositoryName: 'raaulgal09/my-api',
        githubRepoId: '101',
        isPrivate: true,
        action: 'created',
      });

      const savedUser = userStore.get('raul@titanpaas.dev')!;
      expect(savedUser.password).toBeNull();
      expect(savedUser.githubAccessToken).toBeDefined();
      expect(savedUser.githubAccessToken).not.toContain('gho_secret_token');
    });

    it('should link GitHub profile to an existing user matched by email and sync existing project', async () => {
      const existing = await usersService.create!({
        email: 'dev@titanpaas.dev',
        password: 'hashed-password',
        name: 'Existing Dev',
      });
      projectStore.push({
        id: 'existing-proj-1',
        name: 'web-app',
        repositoryUrl: 'https://github.com/dev/web-app.git',
        repositoryName: 'dev/web-app',
        githubRepoId: null,
        isPrivate: false,
        branch: 'main',
        port: 3000,
        envVariables: {},
        healthcheckPath: null,
        healthcheckExpectedStatus: 200,
        healthcheckTimeout: 5,
        healthcheckRetries: 3,
        userId: existing.id,
        user: existing,
        deployments: [],
        customDomains: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      fetchSpy.mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/login/oauth/access_token')) {
          return makeMockResponse(200, { access_token: 'gho_dev_token' });
        }
        if (url.endsWith('/user')) {
          return makeMockResponse(200, {
            id: 555,
            login: 'dev',
            name: 'Dev User',
            email: 'dev@titanpaas.dev',
            avatar_url: null,
          });
        }
        if (url.includes('/user/repos')) {
          return makeMockResponse(200, [
            {
              id: 777,
              name: 'web-app',
              full_name: 'dev/web-app',
              html_url: 'https://github.com/dev/web-app',
              clone_url: 'https://github.com/dev/web-app.git',
              default_branch: 'main',
              private: false,
              fork: false,
              archived: false,
              description: null,
              owner: { login: 'dev' },
            },
          ]);
        }
        return makeMockResponse(404, {});
      });

      const result = await service.authenticateWithCode(
        'code-2',
        undefined,
        true,
      );

      expect(result.github.isNewUser).toBe(false);
      expect(result.github.linkedRepositories).toHaveLength(1);
      expect(result.github.linkedRepositories[0]).toMatchObject({
        projectId: 'existing-proj-1',
        githubRepoId: '777',
        action: 'linked',
      });
      expect(projectStore).toHaveLength(1);
    });

    it('should synchronize GitHub organizations as teams and link org repos with teamId', async () => {
      fetchSpy.mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/login/oauth/access_token')) {
          return makeMockResponse(200, { access_token: 'gho_org_token' });
        }
        if (url.endsWith('/user')) {
          return makeMockResponse(200, {
            id: 555,
            login: 'raaulgal09',
            name: 'Raul Garcia',
            email: 'raul@sotk.dev',
            avatar_url: null,
          });
        }
        if (url.endsWith('/user/emails')) {
          return makeMockResponse(200, [
            { email: 'raul@sotk.dev', primary: true, verified: true },
          ]);
        }
        if (url.includes('/user/memberships/orgs')) {
          return makeMockResponse(200, [
            {
              role: 'admin',
              state: 'active',
              organization: {
                id: 9999,
                login: 'sotk-devs',
                description: 'Organización SOTK',
              },
            },
          ]);
        }
        if (url.includes('/user/repos')) {
          return makeMockResponse(200, [
            {
              id: 888,
              name: 'TitanPaaS',
              full_name: 'sotk-devs/TitanPaaS',
              html_url: 'https://github.com/sotk-devs/TitanPaaS',
              clone_url: 'https://github.com/sotk-devs/TitanPaaS.git',
              default_branch: 'main',
              private: true,
              fork: false,
              archived: false,
              description: 'PaaS platform',
              owner: { login: 'sotk-devs' },
            },
          ]);
        }
        return makeMockResponse(404, {});
      });

      const state = service.generateState({ autoLink: true });
      const result = await service.authenticateWithCode('code-with-org', state);

      expect(teamStore).toHaveLength(1);
      expect(teamStore[0]).toMatchObject({
        name: 'sotk-devs',
        slug: 'sotk-devs',
      });
      expect(teamMemberStore).toHaveLength(1);
      expect(teamMemberStore[0]).toMatchObject({
        teamId: 'team-1',
        role: 'OWNER',
      });

      // Now link the organization repo
      const linkResult = await service.linkRepositories(result.user.id, {
        all: true,
      });

      expect(linkResult.linkedCount).toBe(1);
      expect(projectStore).toHaveLength(1);
      expect(projectStore[0]).toMatchObject({
        name: 'TitanPaaS',
        repositoryName: 'sotk-devs/TitanPaaS',
        teamId: 'team-1',
      });
    });
  });

  describe('listUserRepositories, linkRepositories & unlinkGithubAccount', () => {
    it('should list repositories with link status and manually link with webhook', async () => {
      const user = await usersService.create!({
        email: 'linked@titanpaas.dev',
        password: 'hashed-password',
        name: 'Linked User',
        githubId: 'gh-99',
        githubUsername: 'linkeduser',
        githubAccessToken: JSON.stringify(
          encryptionService.encryptText('gho_stored_token'),
        ),
      });

      fetchSpy.mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes('/user/repos')) {
          return makeMockResponse(200, [
            {
              id: 301,
              name: 'repo-one',
              full_name: 'linkeduser/repo-one',
              html_url: 'https://github.com/linkeduser/repo-one',
              clone_url: 'https://github.com/linkeduser/repo-one.git',
              default_branch: 'main',
              private: false,
              fork: false,
              archived: false,
              description: 'First repo',
              owner: { login: 'linkeduser' },
            },
          ]);
        }
        if (url.endsWith('/hooks') && init?.method === 'POST') {
          return makeMockResponse(201, { id: 1234 });
        }
        return makeMockResponse(404, {});
      });

      const beforeList = await service.listUserRepositories(user.id);
      expect(beforeList).toHaveLength(1);
      expect(beforeList[0].isLinked).toBe(false);

      const linkRes = await service.linkRepositories(user.id, {
        repositories: ['linkeduser/repo-one'],
        configureWebhook: true,
        webhookUrl: 'https://paas.example.com/webhooks/github',
      });
      expect(linkRes.linkedCount).toBe(1);
      expect(linkRes.repositories[0].webhookConfigured).toBe(true);

      const afterList = await service.listUserRepositories(user.id);
      expect(afterList[0].isLinked).toBe(true);
      expect(afterList[0].linkedProjectId).toBe('proj-1');
    });

    it('should prevent unlinking GitHub if user has no local password', async () => {
      const oauthOnly = await usersService.create!({
        email: 'nopass@titanpaas.dev',
        password: null,
        name: 'No Pass',
        githubId: 'gh-1',
        githubUsername: 'nopass',
        githubAccessToken: 'encrypted',
      });

      await expect(service.unlinkGithubAccount(oauthOnly.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should unlink GitHub account when user has a local password', async () => {
      const userWithPass = await usersService.create!({
        email: 'withpass@titanpaas.dev',
        password: 'hashed-password',
        name: 'With Pass',
        githubId: 'gh-2',
        githubUsername: 'withpass',
        githubAccessToken: 'encrypted',
      });

      const res = await service.unlinkGithubAccount(userWithPass.id);
      expect(res.unlinked).toBe(true);
      expect(userWithPass.githubId).toBeNull();
      expect(userWithPass.githubAccessToken).toBeNull();
    });
  });
});
