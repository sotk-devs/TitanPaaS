import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { ClusterController } from '../src/cluster/cluster.controller.js';
import { ClusterService } from '../src/cluster/cluster.service.js';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy.js';
import { UsersService } from '../src/users/users.service.js';
import { NotFoundException } from '@nestjs/common';

describe('ClusterController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let authToken: string;

  const mockUser = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    email: 'admin@titanpaas.local',
    name: 'Admin User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStatus = {
    isSwarmActive: true,
    isManager: true,
    nodeId: 'node-manager-1',
    nodeRole: 'manager',
    clusterNodesCount: 2,
    managersCount: 1,
    workersCount: 1,
    clusterId: 'cluster-abc-123',
    localNodeState: 'active',
  };

  const mockTokens = {
    workerToken: 'SWMTKN-1-worker-token-test',
    managerToken: 'SWMTKN-1-manager-token-test',
    listenAddr: '192.168.1.100:2377',
    workerJoinCommand:
      'docker swarm join --token SWMTKN-1-worker-token-test 192.168.1.100:2377',
    managerJoinCommand:
      'docker swarm join --token SWMTKN-1-manager-token-test 192.168.1.100:2377',
  };

  const mockNodes = [
    {
      id: 'node-manager-1',
      hostname: 'titan-master-1',
      role: 'manager',
      status: 'ready',
      availability: 'active',
      ipAddress: '192.168.1.100',
      isLeader: true,
      dockerEngineVersion: '27.1.1',
      labels: { env: 'production' },
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
      labels: { role: 'worker' },
    },
  ];

  const mockClusterService = {
    getClusterStatus: jest.fn<any>().mockResolvedValue(mockStatus),
    initCluster: jest.fn<any>().mockResolvedValue({
      message: 'Docker Swarm cluster initialized successfully',
      status: mockStatus,
    }),
    getJoinTokens: jest.fn<any>().mockResolvedValue(mockTokens),
    listNodes: jest.fn<any>().mockResolvedValue(mockNodes),
    getNode: jest.fn<any>().mockImplementation(async (id: string) => {
      const node = mockNodes.find((n) => n.id === id);
      if (!node) {
        throw new NotFoundException(
          `Node with ID or hostname "${id}" was not found in cluster`,
        );
      }
      return node;
    }),
    updateNode: jest
      .fn<any>()
      .mockImplementation(async (id: string, dto: any) => ({
        message: 'Node updated successfully',
        node: { ...mockNodes[1], ...dto },
      })),
    removeNode: jest
      .fn<any>()
      .mockResolvedValue({ message: 'Node removed successfully' }),
    leaveCluster: jest
      .fn<any>()
      .mockResolvedValue({ message: 'Left cluster successfully' }),
    deployService: jest.fn<any>().mockResolvedValue({
      serviceName: 'titan-proj-test',
      serviceId: 'srv-12345',
      replicas: 3,
      image: 'registry.titan.local/test-app:latest',
      publishedPort: 8080,
      network: 'titan-overlay',
    }),
    removeService: jest
      .fn<any>()
      .mockResolvedValue({ message: 'Service removed successfully' }),
  };

  const mockUsersService = {
    findById: jest.fn<any>().mockResolvedValue(mockUser),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'titan_paas_secret_key_change_in_prod',
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [ClusterController],
      providers: [
        JwtStrategy,
        {
          provide: ClusterService,
          useValue: mockClusterService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
    authToken = jwtService.sign({
      sub: mockUser.id,
      email: mockUser.email,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Authentication protection', () => {
    it('should reject unauthorized requests without token (401)', async () => {
      await request(app.getHttpServer()).get('/cluster/status').expect(401);
    });
  });

  describe('GET /cluster/status', () => {
    it('should return cluster status when authenticated', async () => {
      const response = await request(app.getHttpServer())
        .get('/cluster/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual(mockStatus);
    });
  });

  describe('POST /cluster/init', () => {
    it('should initialize swarm cluster', async () => {
      const response = await request(app.getHttpServer())
        .post('/cluster/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ advertiseAddr: '192.168.1.100' })
        .expect(200);

      expect(response.body.message).toContain('initialized');
      expect(response.body.status).toEqual(mockStatus);
    });
  });

  describe('GET /cluster/join-tokens', () => {
    it('should return join tokens and commands', async () => {
      const response = await request(app.getHttpServer())
        .get('/cluster/join-tokens')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.workerToken).toBe(mockTokens.workerToken);
      expect(response.body.workerJoinCommand).toBe(
        mockTokens.workerJoinCommand,
      );
    });
  });

  describe('GET /cluster/nodes', () => {
    it('should return list of nodes in the cluster', async () => {
      const response = await request(app.getHttpServer())
        .get('/cluster/nodes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].role).toBe('manager');
    });
  });

  describe('GET /cluster/nodes/:id', () => {
    it('should return node details if found', async () => {
      const response = await request(app.getHttpServer())
        .get('/cluster/nodes/node-manager-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.hostname).toBe('titan-master-1');
    });

    it('should return 404 if node does not exist', async () => {
      await request(app.getHttpServer())
        .get('/cluster/nodes/non-existent-node')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /cluster/nodes/:id', () => {
    it('should update node availability and labels', async () => {
      const response = await request(app.getHttpServer())
        .patch('/cluster/nodes/node-worker-1')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          availability: 'drain',
          labels: { role: 'worker', status: 'drain' },
        })
        .expect(200);

      expect(response.body.message).toContain('updated');
      expect(response.body.node.availability).toBe('drain');
    });
  });

  describe('DELETE /cluster/nodes/:id', () => {
    it('should remove node from cluster', async () => {
      const response = await request(app.getHttpServer())
        .delete('/cluster/nodes/node-worker-1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('removed');
    });
  });

  describe('POST /cluster/leave', () => {
    it('should leave cluster', async () => {
      const response = await request(app.getHttpServer())
        .post('/cluster/leave?force=true')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('Left');
    });
  });

  describe('POST /cluster/services', () => {
    it('should deploy a swarm service', async () => {
      const response = await request(app.getHttpServer())
        .post('/cluster/services')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serviceName: 'titan-proj-test',
          imageTag: 'registry.titan.local/test-app:latest',
          replicas: 3,
          port: 8080,
        })
        .expect(200);

      expect(response.body.serviceName).toBe('titan-proj-test');
      expect(response.body.replicas).toBe(3);
    });
  });

  describe('DELETE /cluster/services/:name', () => {
    it('should remove a swarm service', async () => {
      const response = await request(app.getHttpServer())
        .delete('/cluster/services/titan-proj-test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toContain('removed');
    });
  });
});
