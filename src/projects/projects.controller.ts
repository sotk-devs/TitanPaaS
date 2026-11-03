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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
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
  @ApiOperation({ summary: 'Actualizar configuración de un proyecto' })
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
}
