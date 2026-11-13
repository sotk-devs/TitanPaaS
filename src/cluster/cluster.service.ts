import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import type {
  ClusterNode,
  NodeAvailability,
  NodeRole,
  NodeStatus,
  SwarmClusterStatus,
  SwarmJoinTokens,
  SwarmServiceDeployOptions,
  SwarmServiceResult,
} from './interfaces/cluster-node.interface.js';
import type { InitClusterDto } from './dto/init-cluster.dto.js';
import type { UpdateNodeDto } from './dto/update-node.dto.js';

@Injectable()
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);

  async getClusterStatus(): Promise<SwarmClusterStatus> {
    try {
      const { stdout } = await this.executeCommand('docker', [
        'info',
        '--format',
        '{{json .Swarm}}',
      ]);

      const parsed = JSON.parse(stdout.trim()) as {
        NodeID?: string;
        NodeAddr?: string;
        LocalNodeState?: string;
        ControlAvailable?: boolean;
        Nodes?: number;
        Managers?: number;
      };

      const isActive = parsed.LocalNodeState === 'active';
      const isManager = Boolean(parsed.ControlAvailable);
      const nodeRole: NodeRole | undefined = isActive
        ? isManager
          ? 'manager'
          : 'worker'
        : undefined;

      return {
        isActive,
        nodeId: parsed.NodeID || undefined,
        nodeRole,
        isManager,
        nodesCount: parsed.Nodes || (isActive ? 1 : 0),
        managersCount: parsed.Managers || (isManager ? 1 : 0),
        advertiseAddr: parsed.NodeAddr || undefined,
        controlAvailable: isManager,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to inspect Docker Swarm';
      this.logger.warn(`Error querying Docker Swarm status: ${message}`);
      return {
        isActive: false,
        isManager: false,
        nodesCount: 0,
        managersCount: 0,
        controlAvailable: false,
      };
    }
  }

  async initCluster(
    dto?: InitClusterDto,
  ): Promise<{ message: string; status: SwarmClusterStatus }> {
    const currentStatus = await this.getClusterStatus();
    if (
      currentStatus.isActive &&
      currentStatus.isManager &&
      !dto?.forceNewCluster
    ) {
      return {
        message:
          'Docker Swarm cluster is already initialized and active on this node',
        status: currentStatus,
      };
    }

    const args = ['swarm', 'init'];
    if (dto?.advertiseAddr) {
      args.push('--advertise-addr', dto.advertiseAddr);
    }
    if (dto?.listenAddr) {
      args.push('--listen-addr', dto.listenAddr);
    }
    if (dto?.forceNewCluster) {
      args.push('--force-new-cluster');
    }

    try {
      await this.executeCommand('docker', args);
      this.logger.log('Docker Swarm cluster initialized successfully.');

      // Create attachable overlay network for multi-node container communication
      await this.ensureOverlayNetwork('titan-overlay');

      const updatedStatus = await this.getClusterStatus();
      return {
        message: 'Docker Swarm cluster initialized successfully',
        status: updatedStatus,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Docker swarm init failed';
      this.logger.error(`Failed to initialize Docker Swarm: ${message}`);
      throw new BadRequestException(
        `Failed to initialize Docker Swarm cluster: ${message}`,
      );
    }
  }

  async getJoinTokens(): Promise<SwarmJoinTokens> {
    const status = await this.getClusterStatus();
    if (!status.isActive || !status.isManager) {
      throw new BadRequestException(
        'Docker Swarm cluster is not active or current node is not a manager. Run POST /cluster/init first.',
      );
    }

    const [workerTokenRes, managerTokenRes] = await Promise.all([
      this.executeCommand('docker', ['swarm', 'join-token', '-q', 'worker']),
      this.executeCommand('docker', ['swarm', 'join-token', '-q', 'manager']),
    ]);

    const workerToken = workerTokenRes.stdout.trim();
    const managerToken = managerTokenRes.stdout.trim();

    let managerAddr = status.advertiseAddr;
    if (!managerAddr || managerAddr === '0.0.0.0') {
      try {
        const addrRes = await this.executeCommand('docker', [
          'info',
          '--format',
          '{{.Swarm.NodeAddr}}',
        ]);
        managerAddr = addrRes.stdout.trim();
      } catch {
        managerAddr = '127.0.0.1';
      }
    }

    const formattedAddr = managerAddr.includes(':')
      ? managerAddr
      : `${managerAddr}:2377`;

    return {
      workerToken,
      managerToken,
      workerCommand: `docker swarm join --token ${workerToken} ${formattedAddr}`,
      managerCommand: `docker swarm join --token ${managerToken} ${formattedAddr}`,
    };
  }

  async listNodes(): Promise<ClusterNode[]> {
    const status = await this.getClusterStatus();
    if (!status.isActive) {
      throw new BadRequestException(
        'Docker Swarm cluster is not initialized. Run POST /cluster/init first.',
      );
    }

    try {
      const { stdout } = await this.executeCommand('docker', [
        'node',
        'ls',
        '--format',
        '{{json .}}',
      ]);

      const lines = stdout
        .trim()
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      return lines.map((line) => {
        const parsed = JSON.parse(line) as {
          ID: string;
          Hostname: string;
          Status: string;
          Availability: string;
          ManagerStatus?: string;
          EngineVersion: string;
        };

        const isLeader =
          typeof parsed.ManagerStatus === 'string' &&
          parsed.ManagerStatus.toLowerCase().includes('leader');
        const role: NodeRole =
          typeof parsed.ManagerStatus === 'string' &&
          parsed.ManagerStatus.trim().length > 0
            ? 'manager'
            : 'worker';
        const availability =
          (parsed.Availability?.toLowerCase() as NodeAvailability) || 'active';
        const nodeStatus =
          (parsed.Status?.toLowerCase() as NodeStatus) || 'ready';

        return {
          id: parsed.ID,
          hostname: parsed.Hostname,
          role,
          status: nodeStatus,
          availability,
          isLeader,
          engineVersion: parsed.EngineVersion,
        };
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to list nodes';
      this.logger.error(`Error listing swarm nodes: ${message}`);
      throw new BadRequestException(
        `Failed to retrieve cluster nodes: ${message}`,
      );
    }
  }

  async getNode(nodeId: string): Promise<ClusterNode> {
    try {
      const { stdout } = await this.executeCommand('docker', [
        'node',
        'inspect',
        nodeId,
        '--format',
        '{{json .}}',
      ]);

      const parsed = JSON.parse(stdout.trim()) as {
        ID: string;
        CreatedAt: string;
        UpdatedAt: string;
        Spec: {
          Role: string;
          Availability: string;
          Labels?: Record<string, string>;
        };
        Description: {
          Hostname: string;
          Platform: { Architecture: string; OS: string };
          Resources: { NanoCPUs?: number; MemoryBytes?: number };
          Engine: { EngineVersion: string };
        };
        Status: {
          State: string;
          Addr?: string;
        };
        ManagerStatus?: {
          Leader?: boolean;
          Reachability?: string;
        };
      };

      const role = (parsed.Spec.Role?.toLowerCase() as NodeRole) || 'worker';
      const availability =
        (parsed.Spec.Availability?.toLowerCase() as NodeAvailability) ||
        'active';
      const status =
        (parsed.Status.State?.toLowerCase() as NodeStatus) || 'ready';
      const cpus = parsed.Description.Resources.NanoCPUs
        ? parsed.Description.Resources.NanoCPUs / 1e9
        : undefined;

      return {
        id: parsed.ID,
        hostname: parsed.Description.Hostname,
        role,
        status,
        availability,
        isLeader: Boolean(parsed.ManagerStatus?.Leader),
        engineVersion: parsed.Description.Engine.EngineVersion,
        ipAddress: parsed.Status.Addr,
        labels: parsed.Spec.Labels,
        cpus,
        memoryBytes: parsed.Description.Resources.MemoryBytes,
        createdAt: parsed.CreatedAt,
        updatedAt: parsed.UpdatedAt,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : `Node ${nodeId} not found`;
      throw new NotFoundException(
        `Node with ID or hostname "${nodeId}" not found in cluster: ${message}`,
      );
    }
  }

  async updateNode(
    nodeId: string,
    dto: UpdateNodeDto,
  ): Promise<{ message: string; node: ClusterNode }> {
    const existing = await this.getNode(nodeId);

    if (dto.availability) {
      await this.executeCommand('docker', [
        'node',
        'update',
        '--availability',
        dto.availability,
        existing.id,
      ]);
    }

    if (dto.labels && Object.keys(dto.labels).length > 0) {
      for (const [key, val] of Object.entries(dto.labels)) {
        await this.executeCommand('docker', [
          'node',
          'update',
          '--label-add',
          `${key}=${val}`,
          existing.id,
        ]);
      }
    }

    const updatedNode = await this.getNode(existing.id);
    return {
      message: `Node "${updatedNode.hostname}" (${updatedNode.id}) updated successfully`,
      node: updatedNode,
    };
  }

  async removeNode(
    nodeId: string,
    force = false,
  ): Promise<{ message: string }> {
    const node = await this.getNode(nodeId);

    const args = ['node', 'rm'];
    if (force) {
      args.push('--force');
    }
    args.push(node.id);

    try {
      await this.executeCommand('docker', args);
      return {
        message: `Node "${node.hostname}" (${node.id}) removed from cluster successfully`,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to remove node';
      throw new BadRequestException(
        `Unable to remove node ${nodeId}: ${message}`,
      );
    }
  }

  async leaveCluster(force = false): Promise<{ message: string }> {
    const args = ['swarm', 'leave'];
    if (force) {
      args.push('--force');
    }

    try {
      await this.executeCommand('docker', args);
      return {
        message: 'Node successfully left the Docker Swarm cluster',
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to leave cluster';
      throw new BadRequestException(`Failed to leave cluster: ${message}`);
    }
  }

  async deployService(
    options: SwarmServiceDeployOptions,
  ): Promise<SwarmServiceResult> {
    const status = await this.getClusterStatus();
    if (!status.isActive || !status.isManager) {
      throw new BadRequestException(
        'Docker Swarm cluster is not active or node is not manager. Cannot deploy Swarm service.',
      );
    }

    const network = options.network || 'titan-overlay';
    await this.ensureOverlayNetwork(network);

    const serviceName = options.serviceName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const replicas =
      options.replicas && options.replicas > 0 ? options.replicas : 1;

    let isExisting = false;
    try {
      await this.executeCommand('docker', ['service', 'inspect', serviceName]);
      isExisting = true;
    } catch {
      // Service does not exist in cluster yet
    }

    const envArgs: string[] = [];
    if (options.envVariables) {
      for (const [key, val] of Object.entries(options.envVariables)) {
        envArgs.push('--env', `${key}=${val}`);
      }
    }

    const constraintArgs: string[] = [];
    if (options.placementConstraints?.length) {
      for (const constraint of options.placementConstraints) {
        constraintArgs.push('--constraint', constraint);
      }
    } else {
      // Default to worker nodes for application workload distribution
      constraintArgs.push('--constraint', 'node.role == worker');
    }

    const limitArgs: string[] = [];
    if (options.cpuLimit) {
      limitArgs.push('--limit-cpu', String(options.cpuLimit));
    }
    if (options.memoryLimit) {
      limitArgs.push('--limit-memory', options.memoryLimit);
    }

    let url: string | undefined;
    const labelArgs: string[] = [];
    if (options.subdomain) {
      const baseDomain =
        options.baseDomain || process.env.BASE_DOMAIN || 'localhost';
      url = `http://${options.subdomain}.${baseDomain}`;
      labelArgs.push('--label', 'traefik.enable=true');
      labelArgs.push(
        '--label',
        `traefik.http.routers.${serviceName}.rule=Host(\`${options.subdomain}.${baseDomain}\`)`,
      );
      labelArgs.push(
        '--label',
        `traefik.http.routers.${serviceName}.entrypoints=web`,
      );
      labelArgs.push(
        '--label',
        `traefik.http.services.${serviceName}.loadbalancer.server.port=${options.port}`,
      );
    }

    if (options.labels) {
      for (const [key, val] of Object.entries(options.labels)) {
        labelArgs.push('--label', `${key}=${val}`);
      }
    }

    if (isExisting) {
      const updateArgs = [
        'service',
        'update',
        '--image',
        options.imageTag,
        '--replicas',
        String(replicas),
        ...limitArgs,
        ...envArgs,
        ...labelArgs,
        serviceName,
      ];
      await this.executeCommand('docker', updateArgs);
      return {
        serviceId: serviceName,
        serviceName,
        replicas,
        url,
        logs: `Service ${serviceName} updated across cluster with ${replicas} replica(s).`,
      };
    } else {
      const createArgs = [
        'service',
        'create',
        '--name',
        serviceName,
        '--replicas',
        String(replicas),
        '--network',
        network,
        '--publish',
        `published=${options.port},target=${options.port}`,
        ...constraintArgs,
        ...limitArgs,
        ...labelArgs,
        ...envArgs,
        options.imageTag,
      ];
      const { stdout } = await this.executeCommand('docker', createArgs);
      const serviceId = stdout.trim().split('\n')[0];

      return {
        serviceId,
        serviceName,
        replicas,
        url,
        logs: `Service ${serviceName} created in Swarm cluster with ${replicas} replica(s) distributed across nodes.`,
      };
    }
  }

  async removeService(serviceName: string): Promise<{ message: string }> {
    try {
      await this.executeCommand('docker', ['service', 'rm', serviceName]);
      return {
        message: `Service "${serviceName}" removed from Swarm cluster successfully`,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to remove service';
      throw new BadRequestException(
        `Could not remove service ${serviceName}: ${message}`,
      );
    }
  }

  private async ensureOverlayNetwork(networkName: string): Promise<void> {
    try {
      await this.executeCommand('docker', ['network', 'inspect', networkName]);
    } catch {
      try {
        await this.executeCommand('docker', [
          'network',
          'create',
          '--driver',
          'overlay',
          '--attachable',
          networkName,
        ]);
        this.logger.log(`Created attachable overlay network "${networkName}"`);
      } catch (err: unknown) {
        this.logger.warn(
          `Could not create overlay network ${networkName}: ${err}`,
        );
      }
    }
  }

  async executeCommand(
    command: string,
    args: string[],
    timeoutMs = 15000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: true });
      let stdout = '';
      let stderr = '';
      let finished = false;

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try {
            child.kill();
          } catch {
            // ignore
          }
          reject(
            new Error(
              `Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`,
            ),
          );
        }
      }, timeoutMs);

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      child.on('close', (code) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          if (code !== 0) {
            reject(
              new Error(
                stderr.trim() ||
                  stdout.trim() ||
                  `Command failed with code ${code}`,
              ),
            );
          } else {
            resolve({ stdout, stderr, exitCode: code ?? 0 });
          }
        }
      });
    });
  }
}
