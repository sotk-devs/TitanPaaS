export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  clone_url: string;
  html_url: string;
  default_branch: string;
}

export interface GitHubCommit {
  id: string;
  message: string;
  timestamp: string;
}

export interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  repository: GitHubRepository;
  pusher?: {
    name: string;
    email: string;
  };
  sender?: {
    login: string;
    avatar_url: string;
  };
  commits?: GitHubCommit[];
  head_commit?: GitHubCommit;
}

export interface DeploymentJobData {
  deliveryId: string;
  repositoryName: string;
  cloneUrl: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  receivedAt: string;
}
