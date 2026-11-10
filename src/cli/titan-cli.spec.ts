import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliConfigService } from './config.service.js';
import { TitanApiClient } from './api-client.js';
import { createCli, followDeploymentLogs } from './titan-cli.js';

describe('Titan PaaS CLI', () => {
  let tempDir: string;
  let configService: CliConfigService;
  let mockApiClient: jest.Mocked<TitanApiClient>;
  let consoleLogSpy: ReturnType<typeof jest.spyOn>;
  let consoleErrorSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'titan-cli-test-'));
    configService = new CliConfigService(tempDir);

    mockApiClient = {
      login: jest.fn<any>(),
      getProfile: jest.fn<any>(),
      getProjects: jest.fn<any>(),
      getProject: jest.fn<any>(),
      getDeployments: jest.fn<any>(),
      getDeployment: jest.fn<any>(),
      triggerDeploy: jest.fn<any>(),
      getLogsDownload: jest.fn<any>(),
    } as any;

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('CliConfigService', () => {
    it('should return default config when no config file exists', () => {
      const config = configService.getConfig();
      expect(config.apiUrl).toBe('http://localhost:3000');
      expect(config.token).toBeUndefined();
    });

    it('should save and retrieve config successfully', () => {
      configService.saveConfig({
        token: 'test-token-123',
        email: 'dev@titanpaas.io',
        apiUrl: 'http://custom-api:8080',
      });

      const config = configService.getConfig();
      expect(config.token).toBe('test-token-123');
      expect(config.email).toBe('dev@titanpaas.io');
      expect(config.apiUrl).toBe('http://custom-api:8080');
    });

    it('should clear authentication tokens on logout', () => {
      configService.saveConfig({
        token: 'test-token-123',
        email: 'dev@titanpaas.io',
      });

      configService.clearAuth();

      const config = configService.getConfig();
      expect(config.token).toBeUndefined();
      expect(config.email).toBeUndefined();
    });

    it('should read local project id from .titanrc', () => {
      const rcPath = join(process.cwd(), '.titanrc');
      writeFileSync(rcPath, 'proj-uuid-from-rc', 'utf-8');

      const localId = configService.getLocalProjectId();
      expect(localId).toBe('proj-uuid-from-rc');

      rmSync(rcPath, { force: true });
    });
  });

  describe('TitanApiClient', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('should perform POST /auth/login and return token', async () => {
      const mockResponse = {
        access_token: 'jwt-access-token',
        user: { id: 'u1', email: 'test@example.com', name: 'Tester' },
      };

      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const client = new TitanApiClient({ apiUrl: 'http://localhost:3000' });
      const result = await client.login('test@example.com', 'password123');

      expect(result.access_token).toBe('jwt-access-token');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        }),
      );
    });

    it('should include Authorization header when token is present', async () => {
      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
      });

      const client = new TitanApiClient({
        apiUrl: 'http://localhost:3000',
        token: 'my-secret-token',
      });

      await client.getProjects();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/projects',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-secret-token',
          }),
        }),
      );
    });

    it('should throw an error with API message on non-200 responses', async () => {
      globalThis.fetch = jest.fn<any>().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Invalid credentials' }),
      });

      const client = new TitanApiClient({ apiUrl: 'http://localhost:3000' });
      await expect(client.login('bad@example.com', 'wrong')).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('CLI Commands', () => {
    describe('titan login', () => {
      it('should successfully log in with --email and --password options', async () => {
        mockApiClient.login.mockResolvedValue({
          access_token: 'auth-jwt-token',
          user: { id: 'user-1', email: 'dev@titanpaas.io', name: 'Dev User' },
        });

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync([
          'node',
          'titan',
          'login',
          '-e',
          'dev@titanpaas.io',
          '-p',
          'secret123',
        ]);

        expect(mockApiClient.login).toHaveBeenCalledWith(
          'dev@titanpaas.io',
          'secret123',
        );
        expect(configService.getConfig().token).toBe('auth-jwt-token');
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Successfully logged in as dev@titanpaas.io'),
        );
      });

      it('should handle login error gracefully and set exitCode to 1', async () => {
        mockApiClient.login.mockRejectedValue(
          new Error('Credenciales inválidas'),
        );

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync([
          'node',
          'titan',
          'login',
          '-e',
          'dev@titanpaas.io',
          '-p',
          'wrongpass',
        ]);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Login failed: Credenciales inválidas'),
        );
        expect(process.exitCode).toBe(1);
      });
    });

    describe('titan logout', () => {
      it('should clear stored session', async () => {
        configService.saveConfig({ token: 'active-token' });

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'logout']);

        expect(configService.getConfig().token).toBeUndefined();
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Successfully logged out'),
        );
      });
    });

    describe('titan whoami', () => {
      it('should inform when user is not logged in', async () => {
        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'whoami']);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "Not logged in. Please run 'titan login' first.",
          ),
        );
      });

      it('should display profile when logged in', async () => {
        configService.saveConfig({ token: 'active-token' });
        mockApiClient.getProfile.mockResolvedValue({
          id: 'user-123',
          email: 'admin@titanpaas.io',
          name: 'Admin Titan',
        });

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'whoami']);

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            'Logged in as: admin@titanpaas.io (Admin Titan)',
          ),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('User ID: user-123'),
        );
      });
    });

    describe('titan status', () => {
      it('should require authentication', async () => {
        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'status']);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "Authentication required. Run 'titan login' first.",
          ),
        );
        expect(process.exitCode).toBe(1);
      });

      it('should list all projects when no projectId is provided', async () => {
        configService.saveConfig({ token: 'active-token' });
        mockApiClient.getProjects.mockResolvedValue([
          {
            id: 'proj-1',
            name: 'my-api',
            repositoryName: 'sotk/my-api',
            branch: 'main',
            port: 3000,
          } as any,
          {
            id: 'proj-2',
            name: 'frontend',
            repositoryName: 'sotk/frontend',
            branch: 'production',
            port: 80,
          } as any,
        ]);

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'status']);

        expect(mockApiClient.getProjects).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Found 2 project(s):'),
        );
      });

      it('should display specific project details and latest deployment', async () => {
        configService.saveConfig({ token: 'active-token' });
        mockApiClient.getProject.mockResolvedValue({
          id: 'proj-1',
          name: 'my-api',
          repositoryName: 'sotk/my-api',
          repositoryUrl: 'https://github.com/sotk/my-api.git',
          branch: 'main',
          port: 4000,
          customDomains: [
            { id: 'cd-1', domain: 'api.example.com', status: 'VERIFIED' },
          ],
        } as any);

        mockApiClient.getDeployments.mockResolvedValue({
          items: [
            {
              id: 'deploy-99',
              status: 'DEPLOYED',
              commitSha: 'sha1234567',
              commitMessage: 'Initial release',
              containerId: 'cont-abc',
              startedAt: '2026-11-10T10:00:00Z',
              finishedAt: '2026-11-10T10:01:00Z',
            } as any,
          ],
          total: 1,
        });

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'status', 'proj-1']);

        expect(mockApiClient.getProject).toHaveBeenCalledWith('proj-1');
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('=== Project: my-api ==='),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Domains:      api.example.com [VERIFIED]'),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Status:       DEPLOYED'),
        );
      });
    });

    describe('titan deploy', () => {
      it('should trigger deployment for a project successfully', async () => {
        configService.saveConfig({ token: 'active-token' });
        mockApiClient.triggerDeploy.mockResolvedValue({
          message: 'Deploy queued',
          deploymentId: 'dep-new-123',
          jobId: 'job-456',
          status: 'QUEUED',
        });

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync([
          'node',
          'titan',
          'deploy',
          'proj-1',
          '--branch',
          'main',
          '--commit',
          'abcsha',
        ]);

        expect(mockApiClient.triggerDeploy).toHaveBeenCalledWith(
          'proj-1',
          'main',
          'abcsha',
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Deployment queued successfully!'),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Deployment ID: dep-new-123'),
        );
      });

      it('should fail if no project ID can be resolved', async () => {
        configService.saveConfig({ token: 'active-token' });

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'deploy']);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Please specify a project ID'),
        );
        expect(process.exitCode).toBe(1);
      });
    });

    describe('titan logs', () => {
      it('should print logs from deployment download', async () => {
        configService.saveConfig({ token: 'active-token' });
        mockApiClient.getDeployment.mockResolvedValue({
          id: 'dep-100',
        } as any);
        mockApiClient.getLogsDownload.mockResolvedValue(
          'Container logs line 1\nLine 2',
        );

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'logs', 'dep-100']);

        expect(mockApiClient.getLogsDownload).toHaveBeenCalledWith(
          'dep-100',
          'txt',
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Container logs line 1\nLine 2'),
        );
      });

      it('should resolve project ID to latest deployment when target is a project', async () => {
        configService.saveConfig({ token: 'active-token' });
        mockApiClient.getDeployment.mockRejectedValue(
          new Error('Deployment not found'),
        );
        mockApiClient.getDeployments.mockResolvedValue({
          items: [{ id: 'latest-dep-of-project' } as any],
          total: 1,
        });
        mockApiClient.getLogsDownload.mockResolvedValue(
          'Logs from latest deploy',
        );

        const cli = createCli(configService, mockApiClient);
        await cli.parseAsync(['node', 'titan', 'logs', 'proj-123']);

        expect(mockApiClient.getDeployments).toHaveBeenCalledWith('proj-123');
        expect(mockApiClient.getLogsDownload).toHaveBeenCalledWith(
          'latest-dep-of-project',
          'txt',
        );
      });
    });

    describe('followDeploymentLogs', () => {
      it('should poll deployment logs until terminal status is reached', async () => {
        const stdoutWriteSpy = jest
          .spyOn(process.stdout, 'write')
          .mockImplementation(() => true);

        mockApiClient.getDeployment
          .mockResolvedValueOnce({
            id: 'dep-1',
            status: 'BUILDING',
            logs: 'Building docker image...\n',
          } as any)
          .mockResolvedValueOnce({
            id: 'dep-1',
            status: 'DEPLOYED',
            logs: 'Building docker image...\nContainer started successfully.\n',
          } as any);

        await followDeploymentLogs(mockApiClient, 'dep-1', 10);

        expect(stdoutWriteSpy).toHaveBeenCalledWith(
          'Building docker image...\n',
        );
        expect(stdoutWriteSpy).toHaveBeenCalledWith(
          'Container started successfully.\n',
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Deployment finished with status: DEPLOYED'),
        );

        stdoutWriteSpy.mockRestore();
      });
    });
  });
});
