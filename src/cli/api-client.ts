import type { TitanConfig } from './config.service.js';

export interface LoginResponse {
  access_token: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  role?: string;
  createdAt?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  repositoryUrl: string;
  repositoryName: string;
  branch: string;
  port: number;
  envVariables: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  customDomains?: { id: string; domain: string; status: string }[];
  deployments?: DeploymentResponse[];
}

export interface DeploymentResponse {
  id: string;
  projectId: string;
  status: string;
  branch: string;
  commitSha: string | null;
  commitMessage: string | null;
  logs: string | null;
  containerId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface TriggerDeployResponse {
  message: string;
  jobId: string;
  deploymentId: string;
  status: string;
}

export class TitanApiClient {
  constructor(private readonly config: TitanConfig) {}

  private get baseUrl(): string {
    return (this.config.apiUrl || 'http://localhost:3000').replace(/\/+$/, '');
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.config.token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    if (
      options.body &&
      typeof options.body === 'string' &&
      !headers['Content-Type']
    ) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errorData = (await response.json()) as any;
        if (errorData?.message) {
          errorMessage = Array.isArray(errorData.message)
            ? errorData.message.join(', ')
            : errorData.message;
        }
      } catch {
        // response is not JSON
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getProfile(): Promise<UserProfileResponse> {
    return this.request<UserProfileResponse>('/auth/profile', {
      method: 'GET',
    });
  }

  async getProjects(): Promise<ProjectResponse[]> {
    return this.request<ProjectResponse[]>('/projects', { method: 'GET' });
  }

  async getProject(id: string): Promise<ProjectResponse> {
    return this.request<ProjectResponse>(`/projects/${id}`, { method: 'GET' });
  }

  async getDeployments(
    projectId: string,
  ): Promise<{ items: DeploymentResponse[]; total: number }> {
    return this.request<{ items: DeploymentResponse[]; total: number }>(
      `/projects/${projectId}/deployments`,
      { method: 'GET' },
    );
  }

  async getDeployment(id: string): Promise<DeploymentResponse> {
    return this.request<DeploymentResponse>(`/deployments/${id}`, {
      method: 'GET',
    });
  }

  async triggerDeploy(
    projectId: string,
    branch?: string,
    commitSha?: string,
  ): Promise<TriggerDeployResponse> {
    return this.request<TriggerDeployResponse>(
      `/projects/${projectId}/deployments/trigger`,
      {
        method: 'POST',
        body: JSON.stringify({ branch, commitSha }),
      },
    );
  }

  async getLogsDownload(
    deploymentId: string,
    format: 'txt' | 'json' = 'txt',
  ): Promise<string> {
    return this.request<string>(
      `/deployments/${deploymentId}/logs/download?format=${format}`,
      { method: 'GET' },
    );
  }
}
