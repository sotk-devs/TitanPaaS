import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ImportEnvDto } from './dto/import-env.dto.js';
import { ImportEnvResponseDto } from './dto/import-env-response.dto.js';
import { ExportEnvResponseDto } from './dto/export-env-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un nuevo proyecto' })
  @ApiResponse({
    status: 201,
    description: 'Proyecto creado exitosamente.',
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
    status: 409,
    description: 'Ya existe un proyecto con ese nombre para este usuario.',
  })
  create(
    @Request() req: RequestWithUser,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    return this.projectsService.create(req.user.id, createProjectDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos los proyectos del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de proyectos obtenida exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  findAll(@Request() req: RequestWithUser) {
    return this.projectsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el detalle de un proyecto por su ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del proyecto obtenido exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  findOne(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar configuración de un proyecto',
    description:
      'Actualiza la configuración del proyecto. Si se modifican las variables de entorno y el proyecto está desplegado, el contenedor se recrea en caliente con las nuevas variables sin re-compilar la imagen.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Proyecto actualizado exitosamente.',
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
  @ApiResponse({
    status: 409,
    description: 'Ya existe otro proyecto con ese nombre.',
  })
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(req.user.id, id, updateProjectDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un proyecto' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Proyecto eliminado exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  remove(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.remove(req.user.id, id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detener el contenedor del proyecto sin destruirlo',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenedor detenido exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'No existe un contenedor desplegado para este proyecto.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  stop(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.stopContainer(req.user.id, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar un contenedor previamente detenido del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenedor iniciado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'No existe un contenedor desplegado para este proyecto.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  start(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.startContainer(req.user.id, id);
  }

  @Post(':id/restart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reiniciar el contenedor activo del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Contenedor reiniciado exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description: 'No existe un contenedor desplegado para este proyecto.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  restart(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectsService.restartContainer(req.user.id, id);
  }

  @Post(':id/env/import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Importación masiva de variables de entorno desde formato .env',
    description:
      'Parsea el contenido en texto plano de un archivo .env y actualiza la configuración del proyecto. Soporta modo "merge" (predeterminado) o "replace". Si el proyecto está desplegado, se recrea el contenedor en caliente.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Variables de entorno importadas exitosamente.',
    type: ImportEnvResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Formato de archivo .env inválido o clave incorrecta.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  importEnv(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() importEnvDto: ImportEnvDto,
  ): Promise<ImportEnvResponseDto> {
    return this.projectsService.importEnv(req.user.id, id, importEnvDto);
  }

  @Get(':id/env/export')
  @ApiOperation({
    summary: 'Exportar variables de entorno en formato .env',
    description:
      'Devuelve las variables de entorno del proyecto en formato estándar .env (texto plano con comillas y secuencias de escape según corresponda) o como objeto estructurado en formato JSON.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'text', 'raw'],
    description:
      'Formato de respuesta: "json" (predeterminado) para objeto con raw y variables descifradas, o "text" / "raw" para descarga directa del archivo .env.',
  })
  @ApiProduces('application/json', 'text/plain')
  @ApiResponse({
    status: 200,
    description: 'Variables exportadas exitosamente.',
    type: ExportEnvResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado.',
  })
  async exportEnv(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<ExportEnvResponseDto | string> {
    const result = await this.projectsService.exportEnv(req.user.id, id);

    if (format === 'text' || format === 'raw') {
      if (res) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=".env"');
      }
      return result.raw;
    }

    return result;
  }
}
