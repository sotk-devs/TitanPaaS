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
import { Server, Socket } from 'socket.io';

export interface LogMessagePayload {
  deploymentId: string;
  message: string;
  stream?: 'stdout' | 'stderr';
  timestamp?: string;
}

export interface StatusMessagePayload {
  deploymentId: string;
  status: string;
  progress?: number;
  stage?: string;
  timestamp?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/logs',
})
export class LogsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LogsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected to logs namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected from logs namespace: ${client.id}`);
  }

  @SubscribeMessage('joinDeployment')
  handleJoinDeployment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deploymentId: string } | string,
  ) {
    const deploymentId =
      typeof data === 'string' ? data : (data?.deploymentId ?? '');
    if (!deploymentId) {
      return { error: 'deploymentId is required' };
    }

    const room = `deployment:${deploymentId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);

    return {
      event: 'joined',
      room,
      deploymentId,
    };
  }

  @SubscribeMessage('subscribe_deployment')
  handleSubscribeDeployment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deploymentId: string } | string,
  ) {
    return this.handleJoinDeployment(client, data);
  }

  @SubscribeMessage('leaveDeployment')
  handleLeaveDeployment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deploymentId: string } | string,
  ) {
    const deploymentId =
      typeof data === 'string' ? data : (data?.deploymentId ?? '');
    if (!deploymentId) {
      return { error: 'deploymentId is required' };
    }

    const room = `deployment:${deploymentId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);

    return {
      event: 'left',
      room,
      deploymentId,
    };
  }

  @SubscribeMessage('unsubscribe_deployment')
  handleUnsubscribeDeployment(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deploymentId: string } | string,
  ) {
    return this.handleLeaveDeployment(client, data);
  }

  emitLog(
    deploymentId: string,
    message: string,
    stream: 'stdout' | 'stderr' = 'stdout',
  ) {
    if (!this.server) return;

    const payload: LogMessagePayload = {
      deploymentId,
      message,
      stream,
      timestamp: new Date().toISOString(),
    };

    const room = `deployment:${deploymentId}`;
    this.server.to(room).emit('deployment:log', payload);
    this.server.to(room).emit('log', payload);
  }

  emitStatus(
    deploymentId: string,
    status: string,
    progress?: number,
    stage?: string,
  ) {
    if (!this.server) return;

    const payload: StatusMessagePayload = {
      deploymentId,
      status,
      progress,
      stage,
      timestamp: new Date().toISOString(),
    };

    const room = `deployment:${deploymentId}`;
    this.server.to(room).emit('deployment:status', payload);
    this.server.to(room).emit('status', payload);
  }
}
