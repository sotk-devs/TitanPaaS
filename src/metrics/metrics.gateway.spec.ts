import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { MetricsGateway } from './metrics.gateway.js';
import { ContainerMetrics } from './interfaces/container-metrics.interface.js';

describe('MetricsGateway', () => {
  let gateway: MetricsGateway;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;
  let emittedEvents: Array<{ room?: string; event: string; data: any }>;

  const mockMetric: ContainerMetrics = {
    containerId: 'container-123',
    name: 'titan-app-demo',
    cpuPercentage: 15.0,
    memoryUsage: '200MiB',
    memoryLimit: '2GiB',
    memoryPercentage: 9.7,
    networkInput: '10KB',
    networkOutput: '20KB',
    blockInput: '0B',
    blockOutput: '0B',
    pids: 6,
    timestamp: new Date().toISOString(),
  };

  beforeEach(async () => {
    emittedEvents = [];

    const mockTo = jest.fn().mockImplementation((room: string) => ({
      emit: jest.fn((event: string, data: any) => {
        emittedEvents.push({ room, event, data });
      }),
    }));

    mockServer = {
      to: mockTo as any,
    };

    mockSocket = {
      id: 'mock-socket-id',
      join: jest.fn(),
      leave: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsGateway],
    }).compile();

    gateway = module.get<MetricsGateway>(MetricsGateway);
    gateway.server = mockServer as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection and handleDisconnect', () => {
    it('should handle client connection and disconnection without error', () => {
      expect(() =>
        gateway.handleConnection(mockSocket as Socket),
      ).not.toThrow();
      expect(() =>
        gateway.handleDisconnect(mockSocket as Socket),
      ).not.toThrow();
    });
  });

  describe('joinProject and subscribe_project', () => {
    it('should join client to project room with object payload', () => {
      const result = gateway.handleJoinProject(mockSocket as Socket, {
        projectId: 'project-123',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('project:project-123');
      expect(result).toEqual({
        event: 'joined',
        room: 'project:project-123',
        projectId: 'project-123',
      });
    });

    it('should join client to project room with string payload', () => {
      const result = gateway.handleJoinProject(
        mockSocket as Socket,
        'project-456',
      );

      expect(mockSocket.join).toHaveBeenCalledWith('project:project-456');
      expect(result).toEqual({
        event: 'joined',
        room: 'project:project-456',
        projectId: 'project-456',
      });
    });

    it('should return error if projectId is missing', () => {
      const result = gateway.handleJoinProject(mockSocket as Socket, {
        projectId: '',
      });

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(result).toEqual({ error: 'projectId is required' });
    });

    it('should support subscribe_project alias', () => {
      const result = gateway.handleSubscribeProject(mockSocket as Socket, {
        projectId: 'project-789',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('project:project-789');
      expect(result).toEqual({
        event: 'joined',
        room: 'project:project-789',
        projectId: 'project-789',
      });
    });
  });

  describe('leaveProject and unsubscribe_project', () => {
    it('should leave project room with object payload', () => {
      const result = gateway.handleLeaveProject(mockSocket as Socket, {
        projectId: 'project-123',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('project:project-123');
      expect(result).toEqual({
        event: 'left',
        room: 'project:project-123',
        projectId: 'project-123',
      });
    });

    it('should return error if projectId is missing when leaving', () => {
      const result = gateway.handleLeaveProject(mockSocket as Socket, {
        projectId: '',
      });

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(result).toEqual({ error: 'projectId is required' });
    });

    it('should support unsubscribe_project alias', () => {
      const result = gateway.handleUnsubscribeProject(mockSocket as Socket, {
        projectId: 'project-789',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('project:project-789');
      expect(result).toEqual({
        event: 'left',
        room: 'project:project-789',
        projectId: 'project-789',
      });
    });
  });

  describe('joinContainer and subscribe_container', () => {
    it('should join client to container room', () => {
      const result = gateway.handleJoinContainer(mockSocket as Socket, {
        containerId: 'container-123',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('container:container-123');
      expect(result).toEqual({
        event: 'joined',
        room: 'container:container-123',
        containerId: 'container-123',
      });
    });

    it('should return error if containerId is missing', () => {
      const result = gateway.handleJoinContainer(mockSocket as Socket, {
        containerId: '',
      });

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(result).toEqual({ error: 'containerId is required' });
    });

    it('should support subscribe_container alias', () => {
      const result = gateway.handleSubscribeContainer(mockSocket as Socket, {
        containerId: 'container-789',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('container:container-789');
      expect(result).toEqual({
        event: 'joined',
        room: 'container:container-789',
        containerId: 'container-789',
      });
    });
  });

  describe('leaveContainer and unsubscribe_container', () => {
    it('should leave container room', () => {
      const result = gateway.handleLeaveContainer(mockSocket as Socket, {
        containerId: 'container-123',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('container:container-123');
      expect(result).toEqual({
        event: 'left',
        room: 'container:container-123',
        containerId: 'container-123',
      });
    });

    it('should return error if containerId is missing when leaving', () => {
      const result = gateway.handleLeaveContainer(mockSocket as Socket, {
        containerId: '',
      });

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(result).toEqual({ error: 'containerId is required' });
    });

    it('should support unsubscribe_container alias', () => {
      const result = gateway.handleUnsubscribeContainer(mockSocket as Socket, {
        containerId: 'container-789',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('container:container-789');
      expect(result).toEqual({
        event: 'left',
        room: 'container:container-789',
        containerId: 'container-789',
      });
    });
  });

  describe('emitProjectMetrics', () => {
    it('should emit metrics and metrics:update to project room', () => {
      gateway.emitProjectMetrics('project-123', mockMetric);

      expect(mockServer.to).toHaveBeenCalledWith('project:project-123');
      expect(emittedEvents.length).toBe(2);

      const updateEvent = emittedEvents.find(
        (e) => e.event === 'metrics:update',
      );
      expect(updateEvent).toBeDefined();
      expect(updateEvent?.data).toEqual(mockMetric);

      const metricsEvent = emittedEvents.find((e) => e.event === 'metrics');
      expect(metricsEvent).toBeDefined();
      expect(metricsEvent?.data).toEqual(mockMetric);
    });

    it('should gracefully do nothing if server is not initialized', () => {
      gateway.server = undefined as any;
      expect(() =>
        gateway.emitProjectMetrics('project-123', mockMetric),
      ).not.toThrow();
    });
  });

  describe('emitContainerMetrics', () => {
    it('should emit metrics and metrics:update to container room', () => {
      gateway.emitContainerMetrics('container-123', mockMetric);

      expect(mockServer.to).toHaveBeenCalledWith('container:container-123');
      expect(emittedEvents.length).toBe(2);

      const updateEvent = emittedEvents.find(
        (e) => e.event === 'metrics:update',
      );
      expect(updateEvent).toBeDefined();
      expect(updateEvent?.data).toEqual(mockMetric);
    });

    it('should gracefully do nothing if server is not initialized', () => {
      gateway.server = undefined as any;
      expect(() =>
        gateway.emitContainerMetrics('container-123', mockMetric),
      ).not.toThrow();
    });
  });
});
