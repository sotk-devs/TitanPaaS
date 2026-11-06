import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
import { DeploymentsService } from './deployments.service.js';
import { DeploymentPaginationQueryDto } from './dto/deployment-pagination-query.dto.js';
import { TriggerDeployDto } from './dto/trigger-deploy.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@ApiTags('Deployments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get('projects/:projectId/deployments')
  @ApiOperation({
    summary: 'Listar historial de despliegues de un proyecto específico',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de despliegues obtenido exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Proyecto no encontrado o no pertenece al usuario autenticado.',
  })
  findByProject(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() paginationQuery?: DeploymentPaginationQueryDto,
  ) {
    return this.deploymentsService.findByProject(
      req.user.id,
      projectId,
      paginationQuery,
    );
  }

  @Get('deployments/:id')
  @ApiOperation({
    summary: 'Consultar el detalle completo y logs de un despliegue por ID',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del despliegue',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del despliegue obtenido exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Despliegue no encontrado o no pertenece a un proyecto del usuario autenticado.',
  })
  findOne(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deploymentsService.findOne(req.user.id, id);
  }

  @Post('projects/:id/deploy')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Disparar un despliegue manual bajo demanda para un proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 201,
    description: 'Despliegue manual encolado exitosamente con estado QUEUED.',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de despliegue inválidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Proyecto no encontrado o no pertenece al usuario autenticado.',
  })
  triggerDeploy(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() triggerDeployDto?: TriggerDeployDto,
  ) {
    return this.deploymentsService.triggerManualDeploy(
      req.user.id,
      id,
      triggerDeployDto,
      req.user,
    );
  }

  @Post('deployments/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar un despliegue en curso o encolado',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del despliegue a cancelar',
  })
  @ApiResponse({
    status: 200,
    description: 'Despliegue cancelado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'El despliegue ya se encuentra finalizado y no puede ser cancelado.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Despliegue no encontrado o no pertenece al usuario autenticado.',
  })
  cancelDeployment(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deploymentsService.cancelDeployment(req.user.id, id);
  }
}
