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
import { ContainerMetrics } from './interfaces/container-metrics.interface.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/metrics',
})
export class MetricsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MetricsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected to metrics namespace: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(
      `Client disconnected from metrics namespace: ${client.id}`,
    );
  }

  @SubscribeMessage('joinProject')
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string } | string,
  ) {
    const projectId = typeof data === 'string' ? data : (data?.projectId ?? '');
    if (!projectId) {
      return { error: 'projectId is required' };
    }

    const room = `project:${projectId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);

    return {
      event: 'joined',
      room,
      projectId,
    };
  }

  @SubscribeMessage('subscribe_project')
  handleSubscribeProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string } | string,
  ) {
    return this.handleJoinProject(client, data);
  }

  @SubscribeMessage('leaveProject')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string } | string,
  ) {
    const projectId = typeof data === 'string' ? data : (data?.projectId ?? '');
    if (!projectId) {
      return { error: 'projectId is required' };
    }

    const room = `project:${projectId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);

    return {
      event: 'left',
      room,
      projectId,
    };
  }

  @SubscribeMessage('unsubscribe_project')
  handleUnsubscribeProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string } | string,
  ) {
    return this.handleLeaveProject(client, data);
  }

  @SubscribeMessage('joinContainer')
  handleJoinContainer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { containerId: string } | string,
  ) {
    const containerId =
      typeof data === 'string' ? data : (data?.containerId ?? '');
    if (!containerId) {
      return { error: 'containerId is required' };
    }

    const room = `container:${containerId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);

    return {
      event: 'joined',
      room,
      containerId,
    };
  }

  @SubscribeMessage('subscribe_container')
  handleSubscribeContainer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { containerId: string } | string,
  ) {
    return this.handleJoinContainer(client, data);
  }

  @SubscribeMessage('leaveContainer')
  handleLeaveContainer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { containerId: string } | string,
  ) {
    const containerId =
      typeof data === 'string' ? data : (data?.containerId ?? '');
    if (!containerId) {
      return { error: 'containerId is required' };
    }

    const room = `container:${containerId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);

    return {
      event: 'left',
      room,
      containerId,
    };
  }

  @SubscribeMessage('unsubscribe_container')
  handleUnsubscribeContainer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { containerId: string } | string,
  ) {
    return this.handleLeaveContainer(client, data);
  }

  emitProjectMetrics(projectId: string, metrics: ContainerMetrics) {
    if (!this.server) return;

    const room = `project:${projectId}`;
    this.server.to(room).emit('metrics:update', metrics);
    this.server.to(room).emit('metrics', metrics);
  }

  emitContainerMetrics(containerId: string, metrics: ContainerMetrics) {
    if (!this.server) return;

    const room = `container:${containerId}`;
    this.server.to(room).emit('metrics:update', metrics);
    this.server.to(room).emit('metrics', metrics);
  }
}
