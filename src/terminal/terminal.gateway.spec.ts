import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { TerminalGateway } from './terminal.gateway.js';
import { TerminalService } from './terminal.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';

describe('TerminalGateway', () => {
  let gateway: TerminalGateway;
  let mockTerminalService: jest.Mocked<Partial<TerminalService>>;
  let mockProjectsService: jest.Mocked<Partial<ProjectsService>>;
  let mockDockerPipeline: jest.Mocked<Partial<DockerPipelineService>>;
  let mockJwtService: jest.Mocked<Partial<JwtService>>;
  let mockSocket: Partial<Socket>;
  let emittedEvents: Array<{ event: string; data: any }>;

  const mockProject = {
    id: 'proj-uuid-1',
    name: 'my-project',
    repositoryName: 'sotk-devs/sample-repo',
    branch: 'main',
    port: 3000,
    userId: 'user-uuid-1',
  };

  beforeEach(async () => {
    emittedEvents = [];

    mockSocket = {
      id: 'socket-test-1',
      handshake: {
        auth: {},
        headers: {},
      } as any,
      emit: jest.fn((event: string, data: any) => {
        emittedEvents.push({ event, data });
        return true;
      }) as any,
    };

    mockTerminalService = {
      startSession: jest.fn<any>().mockImplementation((...args: any[]) => {
        // args: socketId, projectId, containerName, shell, onOutput, onExit, onError
        const onOutput = args[4];
        const onExit = args[5];
        const onError = args[6];
        return {
          socketId: args[0],
          projectId: args[1],
          containerName: args[2],
          process: {} as any,
          startedAt: new Date(),
          _triggerOutput: onOutput,
          _triggerExit: onExit,
          _triggerError: onError,
        };
      }),
      writeInput: jest.fn<any>().mockReturnValue(true),
      closeSession: jest.fn<any>().mockReturnValue(true),
      getSession: jest.fn<any>(),
      getActiveSessionsCount: jest.fn<any>().mockReturnValue(0),
    };

    mockProjectsService = {
      findOne: jest.fn<any>().mockResolvedValue(mockProject),
    };

    mockDockerPipeline = {
      generateContainerName: jest
        .fn<any>()
        .mockReturnValue('titan-app-sotk-devs-sample-repo'),
      getContainerStatus: jest.fn<any>().mockResolvedValue('running'),
    };

    mockJwtService = {
      verifyAsync: jest.fn<any>().mockResolvedValue({
        sub: 'user-uuid-1',
        email: 'dev@example.com',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerminalGateway,
        {
          provide: TerminalService,
          useValue: mockTerminalService,
        },
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: DockerPipelineService,
          useValue: mockDockerPipeline,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    gateway = module.get<TerminalGateway>(TerminalGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('Connection events', () => {
    it('should handle handleConnection without error', () => {
      expect(() =>
        gateway.handleConnection(mockSocket as Socket),
      ).not.toThrow();
    });

    it('should close terminal session on handleDisconnect', () => {
      gateway.handleDisconnect(mockSocket as Socket);
      expect(mockTerminalService.closeSession).toHaveBeenCalledWith(
        'socket-test-1',
      );
    });
  });

  describe('terminal:connect and connect_terminal', () => {
    it('should successfully authenticate, verify container, and start session', async () => {
      const result = await gateway.handleConnect(mockSocket as Socket, {
        projectId: 'proj-uuid-1',
        token: 'valid-jwt-token',
        shell: '/bin/sh',
      });

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'valid-jwt-token',
      );
      expect(mockProjectsService.findOne).toHaveBeenCalledWith(
        'user-uuid-1',
        'proj-uuid-1',
      );
      expect(mockDockerPipeline.getContainerStatus).toHaveBeenCalledWith(
        'titan-app-sotk-devs-sample-repo',
      );
      expect(mockTerminalService.startSession).toHaveBeenCalledWith(
        'socket-test-1',
        'proj-uuid-1',
        'titan-app-sotk-devs-sample-repo',
        '/bin/sh',
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      );

      expect(mockSocket.emit).toHaveBeenCalledWith('terminal:ready', {
        projectId: 'proj-uuid-1',
        containerName: 'titan-app-sotk-devs-sample-repo',
        shell: '/bin/sh',
      });

      expect(result).toEqual({
        event: 'connected',
        projectId: 'proj-uuid-1',
        containerName: 'titan-app-sotk-devs-sample-repo',
        shell: '/bin/sh',
      });
    });

    it('should extract Bearer token from handshake headers', async () => {
      mockSocket.handshake = {
        headers: {
          authorization: 'Bearer auth-header-token',
        },
      } as any;

      await gateway.handleConnect(mockSocket as Socket, {
        projectId: 'proj-uuid-1',
      });

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith(
        'auth-header-token',
      );
    });

    it('should return error and emit terminal:error if token is missing', async () => {
      const result = await gateway.handleConnect(mockSocket as Socket, {
        projectId: 'proj-uuid-1',
      });

      expect(result).toHaveProperty('error', 'Unauthorized: missing token');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal:error',
        expect.objectContaining({
          message: expect.stringContaining('token JWT no proporcionado'),
        }),
      );
      expect(mockTerminalService.startSession).not.toHaveBeenCalled();
    });

    it('should return error and emit terminal:error if token is invalid', async () => {
      (mockJwtService.verifyAsync as jest.Mock<any>).mockRejectedValue(
        new Error('Token expired'),
      );

      const result = await gateway.handleConnect(mockSocket as Socket, {
        projectId: 'proj-uuid-1',
        token: 'invalid-token',
      });

      expect(result).toHaveProperty('error', 'Unauthorized: invalid token');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal:error',
        expect.objectContaining({
          message: expect.stringContaining('inválido o expirado'),
        }),
      );
    });

    it('should return error if projectId is missing', async () => {
      const result = await gateway.handleConnect(mockSocket as Socket, {
        projectId: '',
        token: 'valid-token',
      });

      expect(result).toHaveProperty('error', 'projectId is required');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal:error',
        expect.objectContaining({
          message: expect.stringContaining('projectId'),
        }),
      );
    });

    it('should return error if project is not found', async () => {
      (mockProjectsService.findOne as jest.Mock<any>).mockRejectedValue(
        new Error('Not found'),
      );

      const result = await gateway.handleConnect(mockSocket as Socket, {
        projectId: 'unknown-id',
        token: 'valid-token',
      });

      expect(result).toHaveProperty('error', 'Project not found');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal:error',
        expect.objectContaining({
          message: expect.stringContaining('Proyecto no encontrado'),
        }),
      );
    });

    it('should return error if container is not running', async () => {
      (
        mockDockerPipeline.getContainerStatus as jest.Mock<any>
      ).mockResolvedValue('exited');

      const result = await gateway.handleConnect(mockSocket as Socket, {
        projectId: 'proj-uuid-1',
        token: 'valid-token',
      });

      expect(result).toHaveProperty('error', 'Container not running: exited');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal:error',
        expect.objectContaining({
          message: expect.stringContaining('no se encuentra en ejecución'),
        }),
      );
    });

    it('should stream output, exit, and error callbacks to client socket', async () => {
      let registeredOnOutput: any;
      let registeredOnExit: any;
      let registeredOnError: any;

      (mockTerminalService.startSession as jest.Mock<any>).mockImplementation(
        (...args: any[]) => {
          registeredOnOutput = args[4];
          registeredOnExit = args[5];
          registeredOnError = args[6];
          return {} as any;
        },
      );

      await gateway.handleConnect(mockSocket as Socket, {
        projectId: 'proj-uuid-1',
        token: 'valid-token',
      });

      // Test output streaming
      registeredOnOutput('total 12\n-rw-r--r-- index.js\n');
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal:output', {
        output: 'total 12\n-rw-r--r-- index.js\n',
      });

      // Test exit streaming
      registeredOnExit(0);
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal:exit', {
        exitCode: 0,
      });

      // Test error streaming
      registeredOnError(new Error('Process error'));
      expect(mockSocket.emit).toHaveBeenCalledWith('terminal:error', {
        message: 'Process error',
      });
    });

    it('should support connect_terminal alias', async () => {
      const result = await gateway.handleConnectAlias(mockSocket as Socket, {
        projectId: 'proj-uuid-1',
        token: 'valid-token',
      });

      expect(result).toHaveProperty('event', 'connected');
    });
  });

  describe('terminal:input and input', () => {
    it('should forward input string to terminal service', () => {
      const result = gateway.handleInput(mockSocket as Socket, {
        input: 'pwd\n',
      });

      expect(mockTerminalService.writeInput).toHaveBeenCalledWith(
        'socket-test-1',
        'pwd\n',
      );
      expect(result).toEqual({ event: 'input_sent' });
    });

    it('should support raw string payload in handleInput', () => {
      const result = gateway.handleInput(mockSocket as Socket, 'uptime\n');

      expect(mockTerminalService.writeInput).toHaveBeenCalledWith(
        'socket-test-1',
        'uptime\n',
      );
      expect(result).toEqual({ event: 'input_sent' });
    });

    it('should return error if input is not a string', () => {
      const result = gateway.handleInput(mockSocket as Socket, null as any);
      expect(result).toHaveProperty('error', 'input string is required');
    });

    it('should emit terminal:error if no active session exists', () => {
      (mockTerminalService.writeInput as jest.Mock<any>).mockReturnValue(false);

      const result = gateway.handleInput(mockSocket as Socket, 'ls\n');

      expect(result).toHaveProperty('error', 'No active session');
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal:error',
        expect.objectContaining({
          message: expect.stringContaining('No hay ninguna sesión'),
        }),
      );
    });

    it('should support input alias', () => {
      const result = gateway.handleInputAlias(mockSocket as Socket, 'whoami\n');
      expect(result).toEqual({ event: 'input_sent' });
    });
  });

  describe('terminal:disconnect and disconnect_terminal', () => {
    it('should close session and emit terminal:closed', () => {
      const result = gateway.handleDisconnectSession(mockSocket as Socket);

      expect(mockTerminalService.closeSession).toHaveBeenCalledWith(
        'socket-test-1',
      );
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'terminal:closed',
        expect.objectContaining({
          message: expect.stringContaining('Sesión de terminal finalizada'),
        }),
      );
      expect(result).toEqual({ event: 'disconnected', success: true });
    });

    it('should support disconnect_terminal alias', () => {
      const result = gateway.handleDisconnectAlias(mockSocket as Socket);
      expect(result).toEqual({ event: 'disconnected', success: true });
    });
  });
});
