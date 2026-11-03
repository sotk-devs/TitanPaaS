import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { DockerPipelineService } from './docker-pipeline.service.js';

describe('DockerPipelineService', () => {
  let service: DockerPipelineService;

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
        '/tmp/test-dir',
      );

      expect(service.executeCommand).toHaveBeenCalledWith('git', [
        'clone',
        '--depth',
        '1',
        '--branch',
        'main',
        'https://github.com/org/repo.git',
        '/tmp/test-dir',
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
        '/tmp/test-dir',
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

  describe('buildImage', () => {
    it('should invoke docker build and return output logs', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValue({
        stdout: 'Successfully built image-id',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.buildImage(
        'my-image:latest',
        '/tmp/test-dir',
      );

      expect(service.executeCommand).toHaveBeenCalledWith(
        'docker',
        ['build', '-t', 'my-image:latest', '.'],
        '/tmp/test-dir',
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

      await service.buildImage('my-image:latest', '/tmp/test-dir', mockOnLog);

      expect(service.executeCommand).toHaveBeenCalledWith(
        'docker',
        ['build', '-t', 'my-image:latest', '.'],
        '/tmp/test-dir',
        mockOnLog,
      );
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
});
