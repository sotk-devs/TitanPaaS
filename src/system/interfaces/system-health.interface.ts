export type ServiceHealthStatus = 'up' | 'down' | 'degraded';
export type ClusterHealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealth {
  status: ServiceHealthStatus;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface DatabaseServiceHealth extends ServiceHealth {
  version?: string;
  database?: string;
}

export interface RedisServiceHealth extends ServiceHealth {
  host?: string;
  port?: number;
}

export interface DockerServiceHealth extends ServiceHealth {
  version?: string;
  containers?: {
    total: number;
    running: number;
    paused: number;
    stopped: number;
  };
}

export interface MemoryDiagnostics {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usagePercent: number;
  formatted: {
    total: string;
    used: string;
    free: string;
  };
}

export interface DiskDiagnostics {
  path: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  availableBytes: number;
  usagePercent: number;
  formatted: {
    total: string;
    used: string;
    free: string;
  };
}

export interface HostDiagnostics {
  hostname: string;
  platform: string;
  release: string;
  arch: string;
  cpus: {
    count: number;
    model: string;
    speed: number;
  };
  loadAvg: number[];
  uptimeSeconds: number;
}

export interface SystemHealthResponse {
  status: ClusterHealthStatus;
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    docker: ServiceHealth;
  };
}

export interface SystemDiagnosticsResponse {
  status: ClusterHealthStatus;
  timestamp: string;
  host: HostDiagnostics;
  memory: MemoryDiagnostics;
  disk: DiskDiagnostics;
  services: {
    database: DatabaseServiceHealth;
    redis: RedisServiceHealth;
    docker: DockerServiceHealth;
  };
}
