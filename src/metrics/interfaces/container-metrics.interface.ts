export interface RawDockerStats {
  Container?: string;
  ID?: string;
  Name?: string;
  CPUPerc?: string;
  MemUsage?: string;
  MemPerc?: string;
  NetIO?: string;
  BlockIO?: string;
  PIDs?: string;
}

export interface ContainerMetrics {
  containerId: string;
  name: string;
  cpuPercentage: number;
  memoryUsage: string;
  memoryLimit: string;
  memoryPercentage: number;
  networkInput: string;
  networkOutput: string;
  blockInput: string;
  blockOutput: string;
  pids: number;
  timestamp: string;
}
