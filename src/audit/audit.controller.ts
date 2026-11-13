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
  ApiResponse,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AuditService } from './audit.service.js';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';
import { PaginatedAuditLogsResponseDto } from './dto/audit-log-response.dto.js';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('audit-logs')
  @ApiOperation({
    summary:
      'Listar registros de auditoria accesibles para el usuario autenticado',
    description:
      'Devuelve una lista paginada y filtrable de eventos de auditoria ocurridos sobre proyectos y despliegues asociados al usuario o sus organizaciones.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registros de auditoria paginados devueltos exitosamente.',
    type: PaginatedAuditLogsResponseDto,
  })
  async findAll(
    @Request() req: any,
    @Query() query: QueryAuditLogsDto,
  ): Promise<PaginatedAuditLogsResponseDto> {
    const userId = req.user.id || req.user.userId;
    return this.auditService.findAll(userId, query);
  }

  @Get('projects/:projectId/audit-logs')
  @ApiOperation({
    summary: 'Listar registros de auditoria de un proyecto especifico',
    description:
      'Devuelve los eventos de auditoria asociados exclusivamente al proyecto indicado, validando permisos de acceso.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'Identificador UUID del proyecto',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ApiResponse({
    status: 200,
    description: 'Registros de auditoria del proyecto devueltos exitosamente.',
    type: PaginatedAuditLogsResponseDto,
  })
  async findByProject(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: QueryAuditLogsDto,
  ): Promise<PaginatedAuditLogsResponseDto> {
    const userId = req.user.id || req.user.userId;
    return this.auditService.findByProject(userId, projectId, query);
  }
}
