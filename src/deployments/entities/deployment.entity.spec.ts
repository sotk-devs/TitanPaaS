import { describe, it, expect } from '@jest/globals';
import { Deployment } from './deployment.entity.js';
import { DeploymentStatus } from '../enums/deployment-status.enum.js';
import { Project } from '../../projects/entities/project.entity.js';

describe('Deployment Entity', () => {
  it('should correctly instantiate a Deployment entity with all properties', () => {
    const deployment = new Deployment();
    deployment.id = 'uuid-deploy-1';
    deployment.projectId = 'uuid-project-1';
    deployment.status = DeploymentStatus.BUILDING;
    deployment.commitSha = 'a1b2c3d4e5f6789012345678901234567890abcd';
    deployment.commitMessage = 'feat: initial commit';
    deployment.branch = 'main';
    deployment.logs = 'Step 1: Cloning... Done.';
    deployment.stages = [{ name: 'clone', status: 'success', durationMs: 120 }];
    deployment.containerId = 'docker-container-xyz';
    const now = new Date();
    deployment.startedAt = now;
    deployment.finishedAt = now;

    const project = new Project();
    project.id = 'uuid-project-1';
    deployment.project = project;

    expect(deployment.id).toBe('uuid-deploy-1');
    expect(deployment.projectId).toBe('uuid-project-1');
    expect(deployment.status).toBe(DeploymentStatus.BUILDING);
    expect(deployment.commitSha).toBe(
      'a1b2c3d4e5f6789012345678901234567890abcd',
    );
    expect(deployment.commitMessage).toBe('feat: initial commit');
    expect(deployment.branch).toBe('main');
    expect(deployment.logs).toBe('Step 1: Cloning... Done.');
    expect(deployment.stages).toEqual([
      { name: 'clone', status: 'success', durationMs: 120 },
    ]);
    expect(deployment.containerId).toBe('docker-container-xyz');
    expect(deployment.startedAt).toBe(now);
    expect(deployment.finishedAt).toBe(now);
    expect(deployment.project).toBe(project);
  });

  it('should have all expected DeploymentStatus enum values', () => {
    expect(DeploymentStatus.PENDING).toBe('PENDING');
    expect(DeploymentStatus.QUEUED).toBe('QUEUED');
    expect(DeploymentStatus.BUILDING).toBe('BUILDING');
    expect(DeploymentStatus.DEPLOYING).toBe('DEPLOYING');
    expect(DeploymentStatus.DEPLOYED).toBe('DEPLOYED');
    expect(DeploymentStatus.FAILED).toBe('FAILED');
    expect(DeploymentStatus.STOPPED).toBe('STOPPED');
  });
});
