export type NodeRole = 'manager' | 'worker';
export type NodeStatus = 'ready' | 'down' | 'unknown';
export type NodeAvailability = 'active' | 'pause' | 'drain';

export interface ClusterNode {
  id: string;
  hostname: string;
  role: NodeRole;
  status: NodeStatus;
  availability: NodeAvailability;
  isLeader: boolean;
  engineVersion: string;
  ipAddress?: string;
  labels?: Record<string, string>;
  cpus?: number;
  memoryBytes?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SwarmClusterStatus {
  isActive: boolean;
  nodeId?: string;
  nodeRole?: NodeRole;
  isManager: boolean;
  nodesCount: number;
  managersCount: number;
  advertiseAddr?: string;
  controlAvailable?: boolean;
}

export interface SwarmJoinTokens {
  workerToken: string;
  managerToken: string;
  workerCommand: string;
  managerCommand: string;
}

export interface SwarmServiceDeployOptions {
  serviceName: string;
  imageTag: string;
  replicas?: number;
  port: number;
  envVariables?: Record<string, string>;
  subdomain?: string;
  baseDomain?: string;
  network?: string;
  placementConstraints?: string[];
  cpuLimit?: number;
  memoryLimit?: string;
  labels?: Record<string, string>;
}

export interface SwarmServiceResult {
  serviceId: string;
  serviceName: string;
  replicas: number;
  url?: string;
  logs: string;
}
