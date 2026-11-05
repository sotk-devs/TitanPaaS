import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DeploymentsService } from './deployments.service.js';
import { Deployment } from './entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentStatus } from './enums/deployment-status.enum.js';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let mockDeploymentRepo: jest.Mocked<Partial<Repository<Deployment>>>;
  let mockProjectRepo: jest.Mocked<Partial<Repository<Project>>>;

  const userId = 'user-uuid-1';
  const projectId = 'project-uuid-1';
  const deploymentId = 'deployment-uuid-1';

  const mockProject: Project = {
    id: projectId,
    name: 'test-app',
    repositoryUrl: 'https://github.com/org/repo.git',
    repositoryName: 'org/repo',
    branch: 'main',
    port: 3000,
    envVariables: {},
    userId,
    user: null as any,
    deployments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDeployment: Deployment = {
    id: deploymentId,
    projectId,
    project: mockProject,
    status: DeploymentStatus.DEPLOYED,
    commitSha: 'abcdef1234567890',
    commitMessage: 'feat: add deployment',
    branch: 'main',
    logs: 'Build and deploy successful',
    stages: [{ name: 'clone', status: 'success', durationMs: 100 }],
    containerId: 'container-uuid-123',
    startedAt: new Date(),
    finishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockDeploymentRepo = {
      findAndCount: jest.fn<any>().mockResolvedValue([[mockDeployment], 1]),
      findOne: jest.fn<any>().mockResolvedValue(mockDeployment),
    };

    mockProjectRepo = {
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        {
          provide: getRepositoryToken(Deployment),
          useValue: mockDeploymentRepo,
        },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepo,
        },
      ],
    }).compile();

    service = module.get<DeploymentsService>(DeploymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByProject', () => {
    it('should return paginated deployments when project exists and belongs to user', async () => {
      const result = await service.findByProject(userId, projectId, {
        page: 1,
        limit: 10,
      });

      expect(mockProjectRepo.findOne).toHaveBeenCalledWith({
        where: { id: projectId, userId },
      });
      expect(mockDeploymentRepo.findAndCount).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        items: [mockDeployment],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should throw NotFoundException if project does not exist or does not belong to user', async () => {
      mockProjectRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.findByProject('other-user', projectId),
      ).rejects.toThrow(NotFoundException);
      expect(mockDeploymentRepo.findAndCount).not.toHaveBeenCalled();
    });

    it('should use default pagination parameters if none provided', async () => {
      await service.findByProject(userId, projectId);

      expect(mockDeploymentRepo.findAndCount).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });
  });

  describe('findOne', () => {
    it('should return deployment when it exists and belongs to user project', async () => {
      const result = await service.findOne(userId, deploymentId);

      expect(mockDeploymentRepo.findOne).toHaveBeenCalledWith({
        where: { id: deploymentId },
        relations: ['project'],
      });
      expect(result).toEqual(mockDeployment);
    });

    it('should throw NotFoundException if deployment does not exist', async () => {
      mockDeploymentRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne(userId, 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if deployment belongs to another user project', async () => {
      mockDeploymentRepo.findOne.mockResolvedValueOnce({
        ...mockDeployment,
        project: { ...mockProject, userId: 'other-user' },
      });

      await expect(service.findOne(userId, deploymentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
