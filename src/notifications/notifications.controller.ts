import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service.js';
import { CreateNotificationWebhookDto } from './dto/create-notification-webhook.dto.js';
import { UpdateNotificationWebhookDto } from './dto/update-notification-webhook.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un webhook saliente de notificaciones para un proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook de notificación registrado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  create(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() createDto: CreateNotificationWebhookDto,
  ) {
    return this.notificationsService.create(req.user.id, projectId, createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos los webhooks de notificación de un proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de webhooks obtenida exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  findAll(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.notificationsService.findByProject(req.user.id, projectId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar la configuración de un webhook de notificación',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del webhook',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook actualizado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto o webhook no encontrado.',
  })
  update(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateNotificationWebhookDto,
  ) {
    return this.notificationsService.update(
      req.user.id,
      projectId,
      id,
      updateDto,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un webhook de notificación del proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del webhook',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook eliminado exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto o webhook no encontrado.',
  })
  remove(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.remove(req.user.id, projectId, id);
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar una notificación de prueba al webhook configurado',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del webhook',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado del envío de notificación de prueba.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto o webhook no encontrado.',
  })
  test(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationsService.testWebhook(req.user.id, projectId, id);
  }
}
