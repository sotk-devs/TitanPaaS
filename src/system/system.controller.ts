import { Controller, Get, HttpStatus, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SystemService } from './system.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SystemHealthResponseDto } from './dto/system-health-response.dto.js';
import type {
  SystemDiagnosticsResponse,
  SystemHealthResponse,
} from './interfaces/system-health.interface.js';

@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Verificar estado de salud general del cluster TitanPaaS',
    description:
      'Endpoint ligero para probes de orquestadores (Docker, Traefik, Kubernetes) y monitores de disponibilidad. Retorna 200 si esta saludable o degradado, y 503 si algun servicio critico esta caido.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cluster operativo y saludable',
    type: SystemHealthResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description:
      'Uno o mas servicios criticos (PostgreSQL, Redis, Docker) no responden',
  })
  async getHealth(
    @Res({ passthrough: true }) res: Response,
  ): Promise<SystemHealthResponse> {
    const health = await this.systemService.getHealth();
    if (health.status === 'unhealthy') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }

  @Get('diagnostics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Diagnostico administrativo integral de la infraestructura del cluster',
    description:
      'Retorna metricas detalladas del host (CPU, memoria, disco), version y contenedores del daemon Docker, y latencias de conexion a PostgreSQL y Redis. Requiere autenticacion JWT.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Diagnostico detallado de infraestructura obtenido correctamente',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No autorizado - token JWT invalido o no proporcionado',
  })
  async getDiagnostics(): Promise<SystemDiagnosticsResponse> {
    return this.systemService.getDiagnostics();
  }
}
