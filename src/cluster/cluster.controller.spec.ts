import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ClusterController } from './cluster.controller.js';
import { ClusterService } from './cluster.service.js';
import type {
  ClusterNode,
  SwarmClusterStatus,
  SwarmJoinTokens,
  SwarmServiceResult,
} from './interfaces/cluster-node.interface.js';

describe('ClusterController', () => {
  let controller: ClusterController;
  let service: jest.Mocked<ClusterService>;

  const mockStatus: SwarmClusterStatus = {
    isSwarmActive: true,
    isManager: true,
    nodeId: 'node-manager-1',
    nodeRole: 'manager',
    clusterNodesCount: 3,
    managersCount: 1,
    workersCount: 2,
    clusterId: 'cluster-abc-123',
    localNodeState: 'active',
  };

  const mockTokens: SwarmJoinTokens = {
    workerToken: 'SWMTKN-1-worker-token-test',
    managerToken: 'SWMTKN-1-manager-token-test',
    listenAddr: '192.168.1.100:2377',
    workerJoinCommand:
      'docker swarm join --token SWMTKN-1-worker-token-test 192.168.1.100:2377',
    managerJoinCommand:
      'docker swarm join --token SWMTKN-1-manager-token-test 192.168.1.100:2377',
  };

  const mockNodes: ClusterNode[] = [
    {
      id: 'node-manager-1',
      hostname: 'titan-master-1',
      role: 'manager',
      status: 'ready',
      availability: 'active',
      ipAddress: '192.168.1.100',
      isLeader: true,
      dockerEngineVersion: '27.1.1',
      labels: { environment: 'production' },
    },
    {
      id: 'node-worker-1',
      hostname: 'titan-worker-1',
      role: 'worker',
      status: 'ready',
      availability: 'active',
      ipAddress: '192.168.1.101',
      isLeader: false,
      dockerEngineVersion: '27.1.1',
      labels: { tier: 'worker' },
    },
  ];

  beforeEach(async () => {
    const mockClusterService = {
      getClusterStatus: jest
        .fn<() => Promise<SwarmClusterStatus>>()
        .mockResolvedValue(mockStatus),
      initCluster: jest.fn().mockResolvedValue({
        message: 'Docker Swarm cluster initialized successfully',
        status: mockStatus,
      }),
      getJoinTokens: jest
        .fn<() => Promise<SwarmJoinTokens>>()
        .mockResolvedValue(mockTokens),
      listNodes: jest
        .fn<() => Promise<ClusterNode[]>>()
        .mockResolvedValue(mockNodes),
      getNode: jest
        .fn<(id: string) => Promise<ClusterNode>>()
        .mockImplementation(async (id: string) => {
          const found = mockNodes.find((n) => n.id === id);
          if (!found) throw new Error('Not found');
          return found;
        }),
      updateNode: jest
        .fn()
        .mockImplementation(async (id: string, dto: any) => ({
          message: 'Node updated successfully',
          node: { ...mockNodes[1], ...dto },
        })),
      removeNode: jest
        .fn()
        .mockResolvedValue({ message: 'Node removed successfully' }),
      leaveCluster: jest
        .fn()
        .mockResolvedValue({ message: 'Left cluster successfully' }),
      deployService: jest
        .fn<() => Promise<SwarmServiceResult>>()
        .mockResolvedValue({
          serviceName: 'titan-proj-test',
          serviceId: 'srv-12345',
          replicas: 3,
          image: 'registry.titan.local/test-app:latest',
          publishedPort: 8080,
          network: 'titan-overlay',
        }),
      removeService: jest
        .fn()
        .mockResolvedValue({ message: 'Service removed successfully' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClusterController],
      providers: [
        {
          provide: ClusterService,
          useValue: mockClusterService,
        },
      ],
    }).compile();

    controller = module.get<ClusterController>(ClusterController);
    service = module.get(ClusterService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return Swarm cluster status', async () => {
      const result = await controller.getStatus();
      expect(result).toEqual(mockStatus);
      expect(service.getClusterStatus).toHaveBeenCalled();
    });
  });

  describe('initCluster', () => {
    it('should initialize Swarm cluster with provided dto', async () => {
      const dto = { advertiseAddr: '192.168.1.100' };
      const result = await controller.initCluster(dto);
      expect(result.message).toContain('initialized');
      expect(service.initCluster).toHaveBeenCalledWith(dto);
    });
  });

  describe('getJoinTokens', () => {
    it('should return join tokens and join commands', async () => {
      const result = await controller.getJoinTokens();
      expect(result.workerToken).toBe(mockTokens.workerToken);
      expect(result.workerJoinCommand).toBe(mockTokens.workerJoinCommand);
      expect(service.getJoinTokens).toHaveBeenCalled();
    });
  });

  describe('listNodes', () => {
    it('should list all cluster nodes', async () => {
      const result = await controller.listNodes();
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('manager');
      expect(service.listNodes).toHaveBeenCalled();
    });
  });

  describe('getNode', () => {
    it('should return details of a specific node', async () => {
      const result = await controller.getNode('node-manager-1');
      expect(result.hostname).toBe('titan-master-1');
      expect(service.getNode).toHaveBeenCalledWith('node-manager-1');
    });
  });

  describe('updateNode', () => {
    it('should update node availability and labels', async () => {
      const dto = {
        availability: 'drain' as const,
        labels: { maintenance: 'true' },
      };
      const result = await controller.updateNode('node-worker-1', dto);
      expect(result.message).toContain('updated');
      expect(service.updateNode).toHaveBeenCalledWith('node-worker-1', dto);
    });
  });

  describe('removeNode', () => {
    it('should remove node without force flag', async () => {
      const result = await controller.removeNode('node-worker-1');
      expect(result.message).toContain('removed');
      expect(service.removeNode).toHaveBeenCalledWith('node-worker-1', false);
    });

    it('should remove node with force flag when true query param is passed', async () => {
      const result = await controller.removeNode('node-worker-1', 'true');
      expect(result.message).toContain('removed');
      expect(service.removeNode).toHaveBeenCalledWith('node-worker-1', true);
    });
  });

  describe('leaveCluster', () => {
    it('should leave cluster without force flag', async () => {
      const result = await controller.leaveCluster();
      expect(result.message).toContain('Left');
      expect(service.leaveCluster).toHaveBeenCalledWith(false);
    });

    it('should leave cluster with force flag when 1 query param is passed', async () => {
      const result = await controller.leaveCluster('1');
      expect(result.message).toContain('Left');
      expect(service.leaveCluster).toHaveBeenCalledWith(true);
    });
  });

  describe('deployService', () => {
    it('should deploy a swarm service', async () => {
      const dto = {
        serviceName: 'titan-proj-test',
        imageTag: 'registry.titan.local/test-app:latest',
        replicas: 3,
        port: 8080,
      };
      const result = await controller.deployService(dto);
      expect(result.serviceName).toBe('titan-proj-test');
      expect(result.replicas).toBe(3);
      expect(service.deployService).toHaveBeenCalledWith(dto);
    });
  });

  describe('removeService', () => {
    it('should remove a swarm service by name', async () => {
      const result = await controller.removeService('titan-proj-test');
      expect(result.message).toContain('removed');
      expect(service.removeService).toHaveBeenCalledWith('titan-proj-test');
    });
  });
});
