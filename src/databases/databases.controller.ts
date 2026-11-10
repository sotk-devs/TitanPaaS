import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DatabasesService } from './databases.service.js';
import { CreateDatabaseDto } from './dto/create-database.dto.js';
import { DatabaseCredentialsDto } from './dto/database-credentials.dto.js';
import { ProjectDatabase } from './entities/project-database.entity.js';

@ApiTags('Databases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/databases')
export class DatabasesController {
  constructor(private readonly databasesService: DatabasesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Aprovisionar una base de datos dedicada bajo demanda para el proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiResponse({
    status: 201,
    description: 'Base de datos aprovisionada e iniciada exitosamente',
    type: ProjectDatabase,
  })
  @ApiResponse({
    status: 400,
    description: 'Parametros de configuracion invalidos',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT invalido o no suministrado',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado al proyecto especificado',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado',
  })
  @ApiResponse({
    status: 409,
    description:
      'Ya existe una base de datos con el mismo nombre en el proyecto',
  })
  create(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateDatabaseDto,
  ): Promise<ProjectDatabase> {
    return this.databasesService.create(req.user.id, projectId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todas las bases de datos aprovisionadas para el proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de bases de datos del proyecto',
    type: [ProjectDatabase],
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'Proyecto no encontrado' })
  findAll(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<ProjectDatabase[]> {
    return this.databasesService.findAllByProject(req.user.id, projectId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar detalles y estado de una base de datos especifica',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalles de la base de datos',
    type: ProjectDatabase,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'Base de datos no encontrada' })
  findOne(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDatabase> {
    return this.databasesService.findOne(req.user.id, projectId, id);
  }

  @Get(':id/credentials')
  @ApiOperation({
    summary: 'Obtener credenciales y URLs de conexion de la base de datos',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Credenciales de acceso y cadena de conexion',
    type: DatabaseCredentialsDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'Base de datos no encontrada' })
  getCredentials(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DatabaseCredentialsDto> {
    return this.databasesService.getCredentials(req.user.id, projectId, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar el contenedor de la base de datos si esta detenido',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenedor de base de datos iniciado',
    type: ProjectDatabase,
  })
  start(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDatabase> {
    return this.databasesService.start(req.user.id, projectId, id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detener el contenedor de la base de datos',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenedor de base de datos detenido',
    type: ProjectDatabase,
  })
  stop(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDatabase> {
    return this.databasesService.stop(req.user.id, projectId, id);
  }

  @Post(':id/restart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reiniciar el contenedor de la base de datos',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenedor de base de datos reiniciado',
    type: ProjectDatabase,
  })
  restart(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProjectDatabase> {
    return this.databasesService.restart(req.user.id, projectId, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Eliminar una base de datos, destruyendo el contenedor y opcionalmente su volumen persistente',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiQuery({
    name: 'deleteVolume',
    type: 'boolean',
    required: false,
    description:
      'Si es true, destruye tambien el volumen Docker persistente (por defecto true)',
  })
  @ApiResponse({
    status: 200,
    description: 'Base de datos eliminada exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'Base de datos no encontrada' })
  remove(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('deleteVolume') deleteVolume?: string,
  ): Promise<{ message: string }> {
    const shouldDeleteVolume = deleteVolume !== 'false';
    return this.databasesService.remove(
      req.user.id,
      projectId,
      id,
      shouldDeleteVolume,
    );
  }
}
