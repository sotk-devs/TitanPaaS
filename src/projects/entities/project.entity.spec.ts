import { describe, it, expect } from '@jest/globals';
import { Project } from './project.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Deployment } from '../../deployments/entities/deployment.entity.js';
import { DeploymentStatus } from '../../deployments/enums/deployment-status.enum.js';

describe('Project Entity', () => {
  it('should correctly instantiate a Project entity with all properties', () => {
    const project = new Project();
    project.id = 'uuid-project-1';
    project.name = 'my-node-app';
    project.repositoryUrl = 'https://github.com/sotk-devs/sample-repo.git';
    project.repositoryName = 'sotk-devs/sample-repo';
    project.branch = 'main';
    project.port = 8080;
    project.envVariables = { NODE_ENV: 'production', PORT: '8080' };
    project.healthcheckPath = '/healthz';
    project.healthcheckExpectedStatus = 200;
    project.healthcheckTimeout = 5;
    project.healthcheckRetries = 3;
    project.userId = 'uuid-user-1';

    const user = new User();
    user.id = 'uuid-user-1';
    user.email = 'dev@example.com';
    project.user = user;

    const deployment = new Deployment();
    deployment.id = 'uuid-deploy-1';
    deployment.status = DeploymentStatus.DEPLOYED;
    project.deployments = [deployment];

    expect(project.id).toBe('uuid-project-1');
    expect(project.name).toBe('my-node-app');
    expect(project.repositoryUrl).toBe(
      'https://github.com/sotk-devs/sample-repo.git',
    );
    expect(project.repositoryName).toBe('sotk-devs/sample-repo');
    expect(project.branch).toBe('main');
    expect(project.port).toBe(8080);
    expect(project.envVariables).toEqual({
      NODE_ENV: 'production',
      PORT: '8080',
    });
    expect(project.healthcheckPath).toBe('/healthz');
    expect(project.healthcheckExpectedStatus).toBe(200);
    expect(project.healthcheckTimeout).toBe(5);
    expect(project.healthcheckRetries).toBe(3);
    expect(project.userId).toBe('uuid-user-1');
    expect(project.user).toBe(user);
    expect(project.deployments).toHaveLength(1);
    expect(project.deployments[0].status).toBe(DeploymentStatus.DEPLOYED);
  });
});
