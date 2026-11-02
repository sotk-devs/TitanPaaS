export type DeploymentStageName =
  'clone' | 'build' | 'docker_deploy' | 'healthcheck';

export interface DeploymentStage {
  name: DeploymentStageName;
  status: 'success' | 'failed';
  durationMs: number;
}

export interface DeploymentResult {
  jobId: string;
  deliveryId: string;
  repositoryName: string;
  branch: string;
  commitSha: string;
  status: 'completed' | 'failed';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  stages: DeploymentStage[];
}
