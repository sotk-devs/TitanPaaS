export interface DockerPruneDetails {
  deleted: string[];
  spaceReclaimedBytes: number;
  raw: string;
}

export interface DockerPruneResult {
  images: DockerPruneDetails;
  containers: DockerPruneDetails;
  volumes: DockerPruneDetails;
  totalSpaceReclaimedBytes: number;
}

export interface WorkspaceCleanResult {
  workspacesDeleted: string[];
  spaceReclaimedBytes: number;
}

export interface GarbageCollectionOptions {
  olderThanHours?: number;
  pruneImages?: boolean;
  pruneContainers?: boolean;
  pruneVolumes?: boolean;
  cleanWorkspaces?: boolean;
}

export interface GarbageCollectionResult {
  success: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  imagesDeletedCount: number;
  containersDeletedCount: number;
  volumesDeletedCount: number;
  workspacesDeletedCount: number;
  totalSpaceReclaimedBytes: number;
  totalSpaceReclaimedFormatted: string;
  details: {
    docker: DockerPruneResult;
    workspaces: WorkspaceCleanResult;
  };
}

export interface GarbageCollectionStatus {
  isRunning: boolean;
  lastRun: GarbageCollectionResult | null;
  scheduler: {
    enabled: boolean;
    cronExpression: string;
  };
}
