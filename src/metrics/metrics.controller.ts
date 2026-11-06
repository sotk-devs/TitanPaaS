import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MetricsService } from './metrics.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('Metrics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Obtener métricas en tiempo real de todos los contenedores',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas de todos los contenedores obtenidas exitosamente.',
  })
  async getAllMetrics() {
    return this.metricsService.getAllContainersMetrics();
  }

  @Get('containers/:containerId')
  @ApiOperation({
    summary: 'Obtener métricas de un contenedor específico',
  })
  @ApiParam({
    name: 'containerId',
    description: 'ID o nombre del contenedor Docker',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas del contenedor obtenidas exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'Contenedor no encontrado o sin estadísticas activas.',
  })
  async getContainerMetrics(@Param('containerId') containerId: string) {
    const metrics = await this.metricsService.getContainerMetrics(containerId);
    if (!metrics) {
      throw new NotFoundException(
        `Container ${containerId} not found or has no active stats`,
      );
    }
    return metrics;
  }

  @Get('projects/:projectId')
  @ApiOperation({
    summary: 'Obtener métricas del contenedor asociado a un proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas del proyecto obtenidas exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontraron métricas activas para el proyecto.',
  })
  async getProjectMetrics(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    const metrics = await this.metricsService.getProjectMetrics(projectId);
    if (!metrics) {
      throw new NotFoundException(
        `No active metrics found for project ${projectId}`,
      );
    }
    return metrics;
  }
}
