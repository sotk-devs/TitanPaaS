import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GarbageCollectorService } from './garbage-collector.service.js';
import { TriggerGcDto } from './dto/trigger-gc.dto.js';
import type {
  GarbageCollectionResult,
  GarbageCollectionStatus,
} from './interfaces/garbage-collector.interface.js';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(
    private readonly garbageCollectorService: GarbageCollectorService,
  ) {}

  @Post('gc')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar Garbage Collection bajo demanda',
    description:
      'Purga imagenes Docker huerfanas, contenedores detenidos y espacios temporales de construccion antiguos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ciclo de Garbage Collection completado exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - token JWT invalido o no proporcionado',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - ya existe una tarea de GC en ejecucion',
  })
  async triggerGarbageCollection(
    @Body() dto: TriggerGcDto,
  ): Promise<GarbageCollectionResult> {
    return this.garbageCollectorService.runGarbageCollection(dto);
  }

  @Get('gc/status')
  @ApiOperation({
    summary: 'Obtener estado y metricas del recolector de basura',
    description:
      'Retorna el estado de ejecucion actual, fecha de ultima ejecucion y configuracion del programador.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado del sistema de Garbage Collection',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  getStatus(): GarbageCollectionStatus {
    return this.garbageCollectorService.getStatus();
  }
}
