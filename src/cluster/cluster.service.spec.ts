import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClusterService } from './cluster.service.js';

describe('ClusterService', () => {
  let service: ClusterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClusterService],
    }).compile();

    service = module.get<ClusterService>(ClusterService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getClusterStatus', () => {
    it('should return active status when Docker Swarm is active', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValueOnce({
        stdout: JSON.stringify({
          NodeID: 'manager-node-id-1',
          NodeAddr: '192.168.1.100',
          LocalNodeState: 'active',
          ControlAvailable: true,
          Nodes: 3,
          Managers: 1,
        }),
        stderr: '',
        exitCode: 0,
      });

      const status = await service.getClusterStatus();

      expect(status.isActive).toBe(true);
      expect(status.isManager).toBe(true);
      expect(status.nodeRole).toBe('manager');
      expect(status.nodeId).toBe('manager-node-id-1');
      expect(status.nodesCount).toBe(3);
      expect(status.managersCount).toBe(1);
    });

    it('should return inactive status when Docker Swarm is not initialized', async () => {
      jest.spyOn(service, 'executeCommand').mockResolvedValueOnce({
        stdout: JSON.stringify({
          NodeID: '',
          NodeAddr: '',
          LocalNodeState: 'inactive',
          ControlAvailable: false,
          Nodes: 0,
          Managers: 0,
        }),
        stderr: '',
        exitCode: 0,
      });

      const status = await service.getClusterStatus();

      expect(status.isActive).toBe(false);
      expect(status.isManager).toBe(false);
      expect(status.nodeRole).toBeUndefined();
    });

    it('should handle errors gracefully and return inactive status', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockRejectedValueOnce(new Error('Docker daemon not responding'));

      const status = await service.getClusterStatus();

      expect(status.isActive).toBe(false);
      expect(status.nodesCount).toBe(0);
    });
  });

  describe('initCluster', () => {
    it('should return early if cluster is already active on manager node', async () => {
      jest.spyOn(service, 'getClusterStatus').mockResolvedValueOnce({
        isActive: true,
        isManager: true,
        nodeRole: 'manager',
        nodesCount: 1,
        managersCount: 1,
      });

      const result = await service.initCluster();

      expect(result.message).toContain('already initialized');
      expect(result.status.isActive).toBe(true);
    });

    it('should initialize swarm and create titan-overlay network', async () => {
      jest
        .spyOn(service, 'getClusterStatus')
        .mockResolvedValueOnce({
          isActive: false,
          isManager: false,
          nodesCount: 0,
          managersCount: 0,
        })
        .mockResolvedValueOnce({
          isActive: true,
          isManager: true,
          nodeRole: 'manager',
          nodesCount: 1,
          managersCount: 1,
        });

      const executeSpy = jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValue({
          stdout:
            'Swarm initialized: current node (manager-1) is now a manager.',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.initCluster({
        advertiseAddr: '192.168.1.50',
      });

      expect(result.message).toContain('initialized successfully');
      expect(executeSpy).toHaveBeenCalledWith(
        'docker',
        expect.arrayContaining([
          'swarm',
          'init',
          '--advertise-addr',
          '192.168.1.50',
        ]),
      );
    });

    it('should throw BadRequestException if swarm init fails', async () => {
      jest.spyOn(service, 'getClusterStatus').mockResolvedValueOnce({
        isActive: false,
        isManager: false,
        nodesCount: 0,
        managersCount: 0,
      });

      jest
        .spyOn(service, 'executeCommand')
        .mockRejectedValueOnce(
          new Error('This node is already part of a swarm'),
        );

      await expect(service.initCluster()).rejects.toThrow(BadRequestException);
    });
  });

  describe('getJoinTokens', () => {
    it('should return worker and manager join tokens and join commands', async () => {
      jest.spyOn(service, 'getClusterStatus').mockResolvedValueOnce({
        isActive: true,
        isManager: true,
        nodeRole: 'manager',
        nodesCount: 2,
        managersCount: 1,
        advertiseAddr: '192.168.1.100:2377',
      });

      jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValueOnce({
          stdout: 'SWMTKN-1-worker-token-xyz\n',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: 'SWMTKN-1-manager-token-abc\n',
          stderr: '',
          exitCode: 0,
        });

      const tokens = await service.getJoinTokens();

      expect(tokens.workerToken).toBe('SWMTKN-1-worker-token-xyz');
      expect(tokens.managerToken).toBe('SWMTKN-1-manager-token-abc');
      expect(tokens.workerCommand).toBe(
        'docker swarm join --token SWMTKN-1-worker-token-xyz 192.168.1.100:2377',
      );
    });

    it('should throw BadRequestException if cluster is not active or node is not manager', async () => {
      jest.spyOn(service, 'getClusterStatus').mockResolvedValueOnce({
        isActive: false,
        isManager: false,
        nodesCount: 0,
        managersCount: 0,
      });

      await expect(service.getJoinTokens()).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listNodes', () => {
    it('should list all cluster nodes with roles and availability', async () => {
      jest.spyOn(service, 'getClusterStatus').mockResolvedValueOnce({
        isActive: true,
        isManager: true,
        nodesCount: 2,
        managersCount: 1,
      });

      const mockLines = [
        JSON.stringify({
          ID: 'node-mgr-1',
          Hostname: 'titan-manager',
          Status: 'Ready',
          Availability: 'Active',
          ManagerStatus: 'Leader',
          EngineVersion: '26.1.1',
        }),
        JSON.stringify({
          ID: 'node-wrk-2',
          Hostname: 'titan-worker-1',
          Status: 'Ready',
          Availability: 'Active',
          ManagerStatus: '',
          EngineVersion: '26.1.1',
        }),
      ].join('\n');

      jest.spyOn(service, 'executeCommand').mockResolvedValueOnce({
        stdout: mockLines,
        stderr: '',
        exitCode: 0,
      });

      const nodes = await service.listNodes();

      expect(nodes).toHaveLength(2);
      expect(nodes[0].role).toBe('manager');
      expect(nodes[0].isLeader).toBe(true);
      expect(nodes[1].role).toBe('worker');
      expect(nodes[1].isLeader).toBe(false);
      expect(nodes[1].hostname).toBe('titan-worker-1');
    });

    it('should throw BadRequestException if cluster is not initialized', async () => {
      jest.spyOn(service, 'getClusterStatus').mockResolvedValueOnce({
        isActive: false,
        isManager: false,
        nodesCount: 0,
        managersCount: 0,
      });

      await expect(service.listNodes()).rejects.toThrow(BadRequestException);
    });
  });

  describe('getNode', () => {
    it('should return detailed node inspection details', async () => {
      const mockNodeInspect = {
        ID: 'node-wrk-1',
        CreatedAt: '2026-11-12T12:00:00Z',
        UpdatedAt: '2026-11-12T12:05:00Z',
        Spec: {
          Role: 'worker',
          Availability: 'active',
          Labels: { region: 'us-east', tier: 'compute' },
        },
        Description: {
          Hostname: 'worker-node-alpha',
          Platform: { Architecture: 'x86_64', OS: 'linux' },
          Resources: { NanoCPUs: 4000000000, MemoryBytes: 8589934592 },
          Engine: { EngineVersion: '26.1.1' },
        },
        Status: {
          State: 'ready',
          Addr: '192.168.1.20',
        },
      };

      jest.spyOn(service, 'executeCommand').mockResolvedValueOnce({
        stdout: JSON.stringify(mockNodeInspect),
        stderr: '',
        exitCode: 0,
      });

      const node = await service.getNode('node-wrk-1');

      expect(node.id).toBe('node-wrk-1');
      expect(node.hostname).toBe('worker-node-alpha');
      expect(node.role).toBe('worker');
      expect(node.cpus).toBe(4);
      expect(node.memoryBytes).toBe(8589934592);
      expect(node.labels).toEqual({ region: 'us-east', tier: 'compute' });
    });

    it('should throw NotFoundException if node is not found', async () => {
      jest
        .spyOn(service, 'executeCommand')
        .mockRejectedValueOnce(new Error('No such node non-existent-id'));

      await expect(service.getNode('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateNode', () => {
    it('should update node availability and labels', async () => {
      const mockNode = {
        id: 'node-wrk-1',
        hostname: 'worker-node-1',
        role: 'worker' as const,
        status: 'ready' as const,
        availability: 'active' as const,
        isLeader: false,
        engineVersion: '26.1.1',
      };

      jest
        .spyOn(service, 'getNode')
        .mockResolvedValueOnce(mockNode)
        .mockResolvedValueOnce({
          ...mockNode,
          availability: 'drain',
          labels: { maintenance: 'true' },
        });

      const executeSpy = jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValue({
          stdout: 'node-wrk-1',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.updateNode('node-wrk-1', {
        availability: 'drain',
        labels: { maintenance: 'true' },
      });

      expect(result.node.availability).toBe('drain');
      expect(executeSpy).toHaveBeenCalledWith('docker', [
        'node',
        'update',
        '--availability',
        'drain',
        'node-wrk-1',
      ]);
      expect(executeSpy).toHaveBeenCalledWith('docker', [
        'node',
        'update',
        '--label-add',
        'maintenance=true',
        'node-wrk-1',
      ]);
    });
  });

  describe('removeNode', () => {
    it('should remove node from cluster', async () => {
      jest.spyOn(service, 'getNode').mockResolvedValueOnce({
        id: 'node-wrk-1',
        hostname: 'worker-node-1',
        role: 'worker',
        status: 'down',
        availability: 'drain',
        isLeader: false,
        engineVersion: '26.1.1',
      });

      const executeSpy = jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValueOnce({
          stdout: 'node-wrk-1',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.removeNode('node-wrk-1', true);

      expect(result.message).toContain('removed from cluster');
      expect(executeSpy).toHaveBeenCalledWith('docker', [
        'node',
        'rm',
        '--force',
        'node-wrk-1',
      ]);
    });
  });

  describe('deployService', () => {
    it('should deploy a replicated service across worker nodes in Swarm cluster', async () => {
      jest.spyOn(service, 'getClusterStatus').mockResolvedValueOnce({
        isActive: true,
        isManager: true,
        nodesCount: 3,
        managersCount: 1,
      });

      jest
        .spyOn(service, 'executeCommand')
        // network inspect check
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        // service inspect (not existing)
        .mockRejectedValueOnce(new Error('No such service'))
        // service create
        .mockResolvedValueOnce({
          stdout: 'service-id-abc123xyz\n',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.deployService({
        serviceName: 'frontend-app',
        imageTag: 'titanpaas/frontend:v1',
        port: 80,
        replicas: 3,
        subdomain: 'app',
        baseDomain: 'titan.local',
        placementConstraints: ['node.role == worker'],
        envVariables: { NODE_ENV: 'production' },
      });

      expect(result.serviceId).toBe('service-id-abc123xyz');
      expect(result.serviceName).toBe('frontend-app');
      expect(result.replicas).toBe(3);
      expect(result.url).toBe('http://app.titan.local');
    });

    it('should update existing service if it already exists in cluster', async () => {
      jest.spyOn(service, 'getClusterStatus').mockResolvedValueOnce({
        isActive: true,
        isManager: true,
        nodesCount: 3,
        managersCount: 1,
      });

      jest
        .spyOn(service, 'executeCommand')
        // network inspect check
        .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
        // service inspect (existing)
        .mockResolvedValueOnce({
          stdout: 'frontend-app',
          stderr: '',
          exitCode: 0,
        })
        // service update
        .mockResolvedValueOnce({
          stdout: 'frontend-app',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.deployService({
        serviceName: 'frontend-app',
        imageTag: 'titanpaas/frontend:v2',
        port: 80,
        replicas: 4,
      });

      expect(result.serviceName).toBe('frontend-app');
      expect(result.replicas).toBe(4);
      expect(result.logs).toContain('updated across cluster');
    });
  });

  describe('removeService', () => {
    it('should remove service from Swarm cluster', async () => {
      const executeSpy = jest
        .spyOn(service, 'executeCommand')
        .mockResolvedValueOnce({
          stdout: 'frontend-app',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.removeService('frontend-app');

      expect(result.message).toContain('removed from Swarm cluster');
      expect(executeSpy).toHaveBeenCalledWith('docker', [
        'service',
        'rm',
        'frontend-app',
      ]);
    });
  });
});
