import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Servir la interfaz web del Dashboard de TitanPaaS',
    description:
      'Retorna el panel web moderno interactivo con autenticación, gestión de proyectos y métricas de hardware en tiempo real vía WebSocket.',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML del Dashboard Web retornado exitosamente.',
    schema: {
      type: 'string',
      example: '<!DOCTYPE html><html>...</html>',
    },
  })
  getDashboard(): string {
    return this.dashboardService.getDashboardHtml();
  }
}
