import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { LogsGateway } from './logs.gateway.js';

describe('LogsGateway', () => {
  let gateway: LogsGateway;
  let mockServer: Partial<Server>;
  let mockSocket: Partial<Socket>;
  let emittedEvents: Array<{ room?: string; event: string; data: any }>;

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
      providers: [LogsGateway],
    }).compile();

    gateway = module.get<LogsGateway>(LogsGateway);
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

  describe('joinDeployment and subscribe_deployment', () => {
    it('should join client to deployment room with object payload', () => {
      const result = gateway.handleJoinDeployment(mockSocket as Socket, {
        deploymentId: 'dep-123',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('deployment:dep-123');
      expect(result).toEqual({
        event: 'joined',
        room: 'deployment:dep-123',
        deploymentId: 'dep-123',
      });
    });

    it('should join client to deployment room with string payload', () => {
      const result = gateway.handleJoinDeployment(
        mockSocket as Socket,
        'dep-456',
      );

      expect(mockSocket.join).toHaveBeenCalledWith('deployment:dep-456');
      expect(result).toEqual({
        event: 'joined',
        room: 'deployment:dep-456',
        deploymentId: 'dep-456',
      });
    });

    it('should return error if deploymentId is missing', () => {
      const result = gateway.handleJoinDeployment(mockSocket as Socket, {
        deploymentId: '',
      });

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(result).toEqual({ error: 'deploymentId is required' });
    });

    it('should support subscribe_deployment alias', () => {
      const result = gateway.handleSubscribeDeployment(mockSocket as Socket, {
        deploymentId: 'dep-789',
      });

      expect(mockSocket.join).toHaveBeenCalledWith('deployment:dep-789');
      expect(result).toEqual({
        event: 'joined',
        room: 'deployment:dep-789',
        deploymentId: 'dep-789',
      });
    });
  });

  describe('leaveDeployment and unsubscribe_deployment', () => {
    it('should leave room with object payload', () => {
      const result = gateway.handleLeaveDeployment(mockSocket as Socket, {
        deploymentId: 'dep-123',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('deployment:dep-123');
      expect(result).toEqual({
        event: 'left',
        room: 'deployment:dep-123',
        deploymentId: 'dep-123',
      });
    });

    it('should return error if deploymentId is missing when leaving', () => {
      const result = gateway.handleLeaveDeployment(mockSocket as Socket, {
        deploymentId: '',
      });

      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(result).toEqual({ error: 'deploymentId is required' });
    });

    it('should support unsubscribe_deployment alias', () => {
      const result = gateway.handleUnsubscribeDeployment(mockSocket as Socket, {
        deploymentId: 'dep-789',
      });

      expect(mockSocket.leave).toHaveBeenCalledWith('deployment:dep-789');
      expect(result).toEqual({
        event: 'left',
        room: 'deployment:dep-789',
        deploymentId: 'dep-789',
      });
    });
  });

  describe('emitLog', () => {
    it('should emit log and deployment:log events to deployment room', () => {
      gateway.emitLog('dep-123', 'Build started', 'stdout');

      expect(mockServer.to).toHaveBeenCalledWith('deployment:dep-123');
      expect(emittedEvents.length).toBe(2);

      const logEvent = emittedEvents.find((e) => e.event === 'log');
      expect(logEvent).toBeDefined();
      expect(logEvent?.data).toMatchObject({
        deploymentId: 'dep-123',
        message: 'Build started',
        stream: 'stdout',
      });
      expect(logEvent?.data.timestamp).toBeDefined();

      const depLogEvent = emittedEvents.find(
        (e) => e.event === 'deployment:log',
      );
      expect(depLogEvent).toBeDefined();
      expect(depLogEvent?.data.message).toBe('Build started');
    });

    it('should default stream to stdout if not specified', () => {
      gateway.emitLog('dep-123', 'Info message');

      const logEvent = emittedEvents.find((e) => e.event === 'log');
      expect(logEvent?.data.stream).toBe('stdout');
    });

    it('should gracefully do nothing if server is not initialized', () => {
      gateway.server = undefined as any;
      expect(() => gateway.emitLog('dep-123', 'Test')).not.toThrow();
    });
  });

  describe('emitStatus', () => {
    it('should emit status and deployment:status events to deployment room', () => {
      gateway.emitStatus('dep-123', 'BUILDING', 50, 'build');

      expect(mockServer.to).toHaveBeenCalledWith('deployment:dep-123');
      expect(emittedEvents.length).toBe(2);

      const statusEvent = emittedEvents.find((e) => e.event === 'status');
      expect(statusEvent).toBeDefined();
      expect(statusEvent?.data).toMatchObject({
        deploymentId: 'dep-123',
        status: 'BUILDING',
        progress: 50,
        stage: 'build',
      });
      expect(statusEvent?.data.timestamp).toBeDefined();

      const depStatusEvent = emittedEvents.find(
        (e) => e.event === 'deployment:status',
      );
      expect(depStatusEvent).toBeDefined();
      expect(depStatusEvent?.data.status).toBe('BUILDING');
    });

    it('should gracefully do nothing if server is not initialized', () => {
      gateway.server = undefined as any;
      expect(() =>
        gateway.emitStatus('dep-123', 'DEPLOYED', 100, 'completed'),
      ).not.toThrow();
    });
  });
});
