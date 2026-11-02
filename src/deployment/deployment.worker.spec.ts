import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { DeploymentWorker } from './deployment.worker.js';
import { DEPLOY_JOB } from '../webhooks/webhooks.constants.js';
import { DeploymentJobData } from '../webhooks/interfaces/github-payload.interface.js';

describe('DeploymentWorker', () => {
  let worker: DeploymentWorker;

  const mockJobData: DeploymentJobData = {
    deliveryId: 'uuid-1234',
    repositoryName: 'sotk-devs/sample-repo',
    cloneUrl: 'https://github.com/sotk-devs/sample-repo.git',
    branch: 'main',
    commitSha: 'a1b2c3d4e5f6789012345678901234567890abcd',
    commitMessage: 'feat: add deployment pipeline',
    author: 'developer',
    receivedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeploymentWorker],
    }).compile();

    worker = module.get<DeploymentWorker>(DeploymentWorker);
    // Speed up unit tests by mocking delay to 0ms
    jest
      .spyOn(worker as any, 'simulateDelay')
      .mockResolvedValue(undefined as never);
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('process', () => {
    it('should successfully execute all deployment stages and return result', async () => {
      const mockJob = {
        id: 'job-42',
        name: DEPLOY_JOB,
        data: mockJobData,
        updateProgress: jest.fn().mockResolvedValue(undefined as never),
      } as unknown as Job<DeploymentJobData, any, string>;

      const result = await worker.process(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(25);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(75);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);

      expect(result).toEqual(
        expect.objectContaining({
          jobId: 'job-42',
          deliveryId: 'uuid-1234',
          repositoryName: 'sotk-devs/sample-repo',
          branch: 'main',
          commitSha: 'a1b2c3d4e5f6789012345678901234567890abcd',
          status: 'completed',
        }),
      );

      expect(result.stages).toHaveLength(4);
      expect(result.stages.map((s) => s.name)).toEqual([
        'clone',
        'build',
        'docker_deploy',
        'healthcheck',
      ]);
      expect(result.stages.every((s) => s.status === 'success')).toBe(true);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when job name is unsupported', async () => {
      const mockJob = {
        id: 'job-99',
        name: 'unsupported-job-name',
        data: mockJobData,
        updateProgress: jest.fn(),
      } as unknown as Job<DeploymentJobData, any, string>;

      await expect(worker.process(mockJob)).rejects.toThrow(
        'Unsupported job name: unsupported-job-name',
      );
    });
  });

  describe('Worker events', () => {
    it('should handle onCompleted event', () => {
      const mockJob = { id: 'job-1' } as Job;
      expect(() => worker.onCompleted(mockJob)).not.toThrow();
    });

    it('should handle onFailed event', () => {
      const mockJob = { id: 'job-2' } as Job;
      const error = new Error('Build failed');
      expect(() => worker.onFailed(mockJob, error)).not.toThrow();
    });
  });
});
