import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { TerminalService } from './terminal.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';
import type {
  TerminalConnectPayload,
  TerminalInputPayload,
} from './interfaces/terminal-session.interface.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/terminal',
})
export class TerminalGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TerminalGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly terminalService: TerminalService,
    private readonly projectsService: ProjectsService,
    private readonly dockerPipeline: DockerPipelineService,
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected to terminal namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(
      `Client disconnected from terminal namespace: ${client.id}`,
    );
    this.terminalService.closeSession(client.id);
  }

  private extractToken(client: Socket, payloadToken?: string): string | null {
    if (payloadToken) {
      return payloadToken.replace(/^Bearer\s+/i, '');
    }

    const authHeader =
      client.handshake?.auth?.token || client.handshake?.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader) {
      return authHeader.replace(/^Bearer\s+/i, '');
    }

    return null;
  }

  @SubscribeMessage('terminal:connect')
  async handleConnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TerminalConnectPayload,
  ) {
    const token = this.extractToken(client, data?.token);
    if (!token) {
      client.emit('terminal:error', {
        message: 'No autorizado: token JWT no proporcionado.',
      });
      return { error: 'Unauthorized: missing token' };
    }

    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync(token);
      userId = payload.sub;
    } catch {
      client.emit('terminal:error', {
        message: 'No autorizado: token JWT inválido o expirado.',
      });
      return { error: 'Unauthorized: invalid token' };
    }

    if (!data?.projectId) {
      client.emit('terminal:error', {
        message: 'El identificador del proyecto (projectId) es obligatorio.',
      });
      return { error: 'projectId is required' };
    }

    let project: any;
    try {
      project = await this.projectsService.findOne(userId, data.projectId);
    } catch {
      client.emit('terminal:error', {
        message:
          'Proyecto no encontrado o no pertenece al usuario autenticado.',
      });
      return { error: 'Project not found' };
    }

    const containerName = this.dockerPipeline.generateContainerName(
      project.repositoryName,
    );
    const containerStatus =
      await this.dockerPipeline.getContainerStatus(containerName);

    if (containerStatus !== 'running') {
      client.emit('terminal:error', {
        message: `El contenedor "${containerName}" no se encuentra en ejecución (estado actual: ${containerStatus}).`,
      });
      return { error: `Container not running: ${containerStatus}` };
    }

    const shell = data.shell || '/bin/sh';

    this.terminalService.startSession(
      client.id,
      project.id,
      containerName,
      shell,
      (output: string) => {
        client.emit('terminal:output', { output });
      },
      (code: number | null) => {
        client.emit('terminal:exit', { exitCode: code });
      },
      (error: Error) => {
        client.emit('terminal:error', { message: error.message });
      },
    );

    client.emit('terminal:ready', {
      projectId: project.id,
      containerName,
      shell,
    });

    return {
      event: 'connected',
      projectId: project.id,
      containerName,
      shell,
    };
  }

  @SubscribeMessage('connect_terminal')
  handleConnectAlias(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TerminalConnectPayload,
  ) {
    return this.handleConnect(client, data);
  }

  @SubscribeMessage('terminal:input')
  handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TerminalInputPayload | string,
  ) {
    const input = typeof data === 'string' ? data : data?.input;
    if (typeof input !== 'string') {
      return { error: 'input string is required' };
    }

    const success = this.terminalService.writeInput(client.id, input);
    if (!success) {
      client.emit('terminal:error', {
        message: 'No hay ninguna sesión interactiva activa para este cliente.',
      });
      return { error: 'No active session' };
    }

    return { event: 'input_sent' };
  }

  @SubscribeMessage('input')
  handleInputAlias(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TerminalInputPayload | string,
  ) {
    return this.handleInput(client, data);
  }

  @SubscribeMessage('terminal:disconnect')
  handleDisconnectSession(@ConnectedSocket() client: Socket) {
    const success = this.terminalService.closeSession(client.id);
    client.emit('terminal:closed', {
      message: 'Sesión de terminal finalizada.',
    });
    return { event: 'disconnected', success };
  }

  @SubscribeMessage('disconnect_terminal')
  handleDisconnectAlias(@ConnectedSocket() client: Socket) {
    return this.handleDisconnectSession(client);
  }
}
