import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DockerPipelineService } from './docker-pipeline.service.js';

describe('DockerPipelineService', () => {
  let service: DockerPipelineService;
  const testDir = join(tmpdir(), 'titan-paas-test-dir');

  beforeEach(() => {
    service = new DockerPipelineService();
  });

  it('should generate correct image tag and container name', () => {
    const tag = service.generateImageTag(
      'sotk-devs/sample-repo',
      'abcdef123456',
    );
    expect(tag).toBe('titan-sotk-devs-sample-repo:abcdef1');

    const name = service.generateContainerName('sotk-devs/sample-repo');
    expect(name).toBe('titan-app-sotk-devs-sample-repo');
  });

  it('should generate valid workspace path', () => {
    const path = service.getWorkspacePath(
      'sotk-devs/sample-repo',
      'abcdef123456',
    );
    expect(path).toContain('titan-paas');
    expect(path).toContain('sotk_devs_sample_repo');
  });

  describe('generateSubdomain', () => {
    it('should extract and sanitize subdomain from repository name', () => {
      expect(service.generateSubdomain('sotk-devs/sample-repo')).toBe(
        'sample-repo',
      );
      expect(service.generateSubdomain('My_Awesome_Project!')).toBe(
        'my-awesome-project',
      );
      expect(service.generateSubdomain('simple-app')).toBe('simple-app');
    });
  });

  describe('cloneRepository', () => {
    it('should invoke git clone and return logs and duration', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'Cloning into target...',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.cloneRepository(
        'https://github.com/org/repo.git',
        'main',
        'abc1234',
        testDir,
      );

      expect(service.executeCommand).toHaveBeenCalledWith('git', [
        'clone',
        '--depth',
        '1',
        '--branch',
        'main',
        'https://github.com/org/repo.git',
        testDir,
      ]);
      expect(result.logs).toContain('Cloning into target...');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should pass onLog callback to executeCommand when provided', async () => {
      const mockOnLog = jest.fn();
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'Cloning...',
        stderr: '',
        exitCode: 0,
      });

      await service.cloneRepository(
        'https://github.com/org/repo.git',
        'main',
        '',
        testDir,
        mockOnLog,
      );

      expect(service.executeCommand).toHaveBeenCalledWith(
        'git',
        expect.any(Array),
        undefined,
        mockOnLog,
      );
    });
  });

  describe('hasDockerfile', () => {
    it('should return false if directory does not have Dockerfile', async () => {
      const result = await service.hasDockerfile(testDir);
      expect(result).toBe(false);
    });
  });

  describe('detectRuntime', () => {
    it('should detect Dockerfile if present', async () => {
      jest.spyOn(service, 'hasDockerfile').mockResolvedValue(true);
      const result = await service.detectRuntime(testDir);
      expect(result).toEqual({
        hasDockerfile: true,
        buildTool: 'docker',
      });
    });

    it('should return Unknown runtime when no matching files are found', async () => {
      jest.spyOn(service, 'hasDockerfile').mockResolvedValue(false);
      const result = await service.detectRuntime(testDir);
      expect(result).toEqual({
        hasDockerfile: false,
        language: 'Unknown',
        buildTool: 'nixpacks',
      });
    });
  });

  describe('buildWithDocker', () => {
    it('should invoke docker build and return output logs', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'Successfully built image-id',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.buildWithDocker('my-image:latest', testDir);

      expect(service.executeCommand).toHaveBeenCalledWith(
        'docker',
        ['build', '-t', 'my-image:latest', '.'],
        testDir,
      );
      expect(result.logs).toContain('Successfully built');
    });

    it('should pass onLog callback to executeCommand when provided', async () => {
      const mockOnLog = jest.fn();
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'Step 1/5...',
        stderr: '',
        exitCode: 0,
      });

      await service.buildWithDocker('my-image:latest', testDir, mockOnLog);

      expect(service.executeCommand).toHaveBeenCalledWith(
        'docker',
        ['build', '-t', 'my-image:latest', '.'],
        testDir,
        mockOnLog,
      );
    });
  });

  describe('buildWithNixpacks', () => {
    it('should invoke nixpacks build and return output logs', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'Successfully built with nixpacks',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.buildWithNixpacks(
        'my-image:latest',
        testDir,
      );

      expect(service.executeCommand).toHaveBeenCalledWith(
        'nixpacks',
        ['build', '.', '--name', 'my-image:latest'],
        testDir,
      );
      expect(result.logs).toContain('Successfully built with nixpacks');
    });

    it('should pass onLog callback to executeCommand when provided', async () => {
      const mockOnLog = jest.fn();
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'Nixpacks phase 1...',
        stderr: '',
        exitCode: 0,
      });

      await service.buildWithNixpacks('my-image:latest', testDir, mockOnLog);

      expect(service.executeCommand).toHaveBeenCalledWith(
        'nixpacks',
        ['build', '.', '--name', 'my-image:latest'],
        testDir,
        mockOnLog,
      );
    });
  });

  describe('buildImage', () => {
    it('should invoke docker build when Dockerfile is detected', async () => {
      jest.spyOn(service, 'detectRuntime').mockResolvedValue({
        hasDockerfile: true,
        buildTool: 'docker',
      });
      jest.spyOn(service, 'buildWithDocker').mockResolvedValue({
        logs: 'Docker built successfully',
        durationMs: 50,
      });

      const mockOnLog = jest.fn();
      const result = await service.buildImage(
        'my-image:latest',
        testDir,
        mockOnLog,
      );

      expect(service.buildWithDocker).toHaveBeenCalledWith(
        'my-image:latest',
        testDir,
        mockOnLog,
      );
      expect(mockOnLog).toHaveBeenCalledWith(
        expect.stringContaining('Dockerfile detected'),
        'stdout',
      );
      expect(result.logs).toBe('Docker built successfully');
    });

    it('should invoke nixpacks build when Dockerfile is not detected', async () => {
      jest.spyOn(service, 'detectRuntime').mockResolvedValue({
        hasDockerfile: false,
        language: 'Node.js',
        buildTool: 'nixpacks',
      });
      jest.spyOn(service, 'buildWithNixpacks').mockResolvedValue({
        logs: 'Nixpacks built successfully',
        durationMs: 70,
      });

      const mockOnLog = jest.fn();
      const result = await service.buildImage(
        'my-image:latest',
        testDir,
        mockOnLog,
      );

      expect(service.buildWithNixpacks).toHaveBeenCalledWith(
        'my-image:latest',
        testDir,
        mockOnLog,
      );
      expect(mockOnLog).toHaveBeenCalledWith(
        expect.stringContaining('Auto-detected Node.js runtime'),
        'stdout',
      );
      expect(result.logs).toBe('Nixpacks built successfully');
    });
  });

  describe('runContainer', () => {
    it('should stop previous container and run new container with env variables and port', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // docker rm -f
        .mockResolvedValueOnce({
          stdout: 'container-id-12345\n',
          stderr: '',
          exitCode: 0,
        }); // docker run

      const result = await service.runContainer(
        'my-image:latest',
        'my-container',
        4000,
        { NODE_ENV: 'production', PORT: '4000' },
      );

      expect(service.executeCommand).toHaveBeenCalledWith('docker', [
        'run',
        '-d',
        '--name',
        'my-container',
        '-p',
        '4000:4000',
        '-e',
        'NODE_ENV=production',
        '-e',
        'PORT=4000',
        'my-image:latest',
      ]);
      expect(result.containerId).toBe('container-id-12345');
    });

    it('should configure Traefik labels and network when subdomain is provided in options', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: 'container-id-traefik\n',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.runContainer(
        'titan-app:latest',
        'titan-app-demo',
        3000,
        { PORT: '3000' },
        {
          subdomain: 'demo-app',
          baseDomain: 'localhost',
          network: 'titan-network',
        },
      );

      expect(service.executeCommand).toHaveBeenCalledWith('docker', [
        'run',
        '-d',
        '--name',
        'titan-app-demo',
        '--network',
        'titan-network',
        '-p',
        '3000:3000',
        '--label',
        'traefik.enable=true',
        '--label',
        'traefik.http.routers.titan-app-demo.rule=Host(`demo-app.localhost`)',
        '--label',
        'traefik.http.routers.titan-app-demo.entrypoints=web',
        '--label',
        'traefik.http.services.titan-app-demo.loadbalancer.server.port=3000',
        '--label',
        'traefik.docker.network=titan-network',
        '-e',
        'PORT=3000',
        'titan-app:latest',
      ]);
      expect(result.containerId).toBe('container-id-traefik');
      expect(result.url).toBe('http://demo-app.localhost');
      expect(result.logs).toContain('http://demo-app.localhost');
    });

    it('should configure cgroups resource limits (--cpus, --memory, --memory-swap) when provided', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        .mockResolvedValueOnce({
          stdout: 'container-id-limits\n',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.runContainer(
        'titan-app:latest',
        'titan-app-limits',
        3000,
        { PORT: '3000' },
        {
          resourceLimits: {
            cpus: 1.5,
            memory: '512m',
            memorySwap: '1g',
          },
        },
      );

      expect(service.executeCommand).toHaveBeenCalledWith('docker', [
        'run',
        '-d',
        '--name',
        'titan-app-limits',
        '-p',
        '3000:3000',
        '--cpus',
        '1.5',
        '--memory',
        '512m',
        '--memory-swap',
        '1g',
        '-e',
        'PORT=3000',
        'titan-app:latest',
      ]);
      expect(result.containerId).toBe('container-id-limits');
    });
  });

  describe('checkHealth', () => {
    it('should return health verified when status is running', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'running\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.checkHealth('container-id-12345');
      expect(result.logs).toContain('Container health verified: running');
    });

    it('should throw error when status is not running', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'exited\n',
        stderr: '',
        exitCode: 0,
      });

      await expect(service.checkHealth('container-id-12345')).rejects.toThrow(
        'Container is not running. Current status: exited',
      );
    });
  });

  describe('checkHttpHealth', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success when status matches expectedStatus', async () => {
      global.fetch = jest.fn<any>().mockResolvedValue({
        status: 200,
      });

      const onLog = jest.fn();
      const result = await service.checkHttpHealth({
        url: 'http://localhost:3000/healthz',
        expectedStatus: 200,
        retries: 2,
        retryIntervalMs: 10,
        onLog,
      });

      expect(result.logs).toContain('HTTP Healthcheck passed');
      expect(onLog).toHaveBeenCalled();
    });

    it('should retry and succeed if subsequent attempt returns expectedStatus', async () => {
      global.fetch = jest
        .fn<any>()
        .mockResolvedValueOnce({ status: 503 })
        .mockResolvedValueOnce({ status: 200 });

      const result = await service.checkHttpHealth({
        url: 'http://localhost:3000/healthz',
        expectedStatus: 200,
        retries: 3,
        retryIntervalMs: 10,
      });

      expect(result.logs).toContain('HTTP Healthcheck passed');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when all retries fail with unexpected status', async () => {
      global.fetch = jest.fn<any>().mockResolvedValue({ status: 500 });

      await expect(
        service.checkHttpHealth({
          url: 'http://localhost:3000/healthz',
          expectedStatus: 200,
          retries: 2,
          retryIntervalMs: 10,
        }),
      ).rejects.toThrow('HTTP Healthcheck failed');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error when all retries fail with network error', async () => {
      global.fetch = jest
        .fn<any>()
        .mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.checkHttpHealth({
          url: 'http://localhost:3000/healthz',
          expectedStatus: 200,
          retries: 2,
          retryIntervalMs: 10,
        }),
      ).rejects.toThrow('HTTP Healthcheck failed');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error if signal is aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        service.checkHttpHealth({
          url: 'http://localhost:3000/healthz',
          signal: controller.signal,
        }),
      ).rejects.toThrow('Healthcheck operation was cancelled');
    });
  });

  describe('abortDeployment and abort signals', () => {
    it('should register an abort controller and return its signal', () => {
      const signal = service.registerDeploymentAbort('dep-123');
      expect(signal).toBeDefined();
      expect(signal.aborted).toBe(false);
    });

    it('should abort an active deployment signal and return true', () => {
      const signal = service.registerDeploymentAbort('dep-123');
      const aborted = service.abortDeployment('dep-123');

      expect(aborted).toBe(true);
      expect(signal.aborted).toBe(true);
    });

    it('should return false when trying to abort an unknown or already aborted deployment', () => {
      const aborted = service.abortDeployment('unknown-dep');
      expect(aborted).toBe(false);
    });

    it('should remove the controller when unregistered', () => {
      service.registerDeploymentAbort('dep-123');
      service.unregisterDeploymentAbort('dep-123');
      expect(service.abortDeployment('dep-123')).toBe(false);
    });
  });

  describe('Container Lifecycle methods', () => {
    it('should execute docker stop on stopContainer', async () => {
      const spy = jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'titan-app-test\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.stopContainer('titan-app-test');

      expect(spy).toHaveBeenCalledWith('docker', ['stop', 'titan-app-test']);
      expect(result.logs).toBe('titan-app-test');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should execute docker start on startContainer', async () => {
      const spy = jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'titan-app-test\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.startContainer('titan-app-test');

      expect(spy).toHaveBeenCalledWith('docker', ['start', 'titan-app-test']);
      expect(result.logs).toBe('titan-app-test');
    });

    it('should execute docker restart on restartContainer', async () => {
      const spy = jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'titan-app-test\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.restartContainer('titan-app-test');

      expect(spy).toHaveBeenCalledWith('docker', ['restart', 'titan-app-test']);
      expect(result.logs).toBe('titan-app-test');
    });

    it('should return container status on getContainerStatus', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'running\n',
        stderr: '',
        exitCode: 0,
      });

      const status = await service.getContainerStatus('titan-app-test');
      expect(status).toBe('running');
    });

    it('should return not_found when inspect fails on getContainerStatus', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockRejectedValue(new Error('No such container'));

      const status = await service.getContainerStatus('titan-app-nonexistent');
      expect(status).toBe('not_found');
    });
  });
});
