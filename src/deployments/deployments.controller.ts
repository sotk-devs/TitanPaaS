import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
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
    @Query() query: DeploymentPaginationQueryDto,
  ) {
    return this.deploymentsService.findByProject(req.user.id, projectId, query);
  }

  @Get('deployments/:id')
  @ApiOperation({
    summary: 'Consultar detalle y logs de un despliegue específico',
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
}
