import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { VolumesService } from './volumes.service.js';
import { CreateVolumeDto } from './dto/create-volume.dto.js';
import { UpdateVolumeDto } from './dto/update-volume.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@ApiTags('Volumes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/volumes')
export class VolumesController {
  constructor(private readonly volumesService: VolumesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Adjuntar un nuevo volumen persistente a un proyecto',
    description:
      'Crea un volumen gestionado en Docker y lo asocia al proyecto para ser montado en sus despliegues.',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador unico del proyecto',
  })
  @ApiResponse({
    status: 201,
    description: 'Volumen persistente creado y adjuntado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Parametros de creacion invalidos',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - no eres dueno del proyecto',
  })
  @ApiResponse({
    status: 404,
    description: 'Proyecto no encontrado',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - ya existe un volumen con el mismo nombre o ruta de montaje',
  })
  async create(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateVolumeDto,
  ) {
    return this.volumesService.create(req.user.id, projectId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos los volumenes persistentes de un proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador unico del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de volumenes adjuntos al proyecto',
  })
  async findAll(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.volumesService.findAllByProject(req.user.id, projectId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de un volumen persistente especifico',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador unico del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador unico del volumen',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del volumen persistente',
  })
  @ApiResponse({
    status: 404,
    description: 'Volumen o proyecto no encontrado',
  })
  async findOne(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.volumesService.findOne(req.user.id, projectId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar configuracion de un volumen persistente',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador unico del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador unico del volumen',
  })
  @ApiResponse({
    status: 200,
    description: 'Volumen actualizado exitosamente',
  })
  async update(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVolumeDto,
  ) {
    return this.volumesService.update(req.user.id, projectId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar y desasociar un volumen persistente',
    description:
      'Elimina el registro de la base de datos y destruye el volumen fisico en Docker.',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador unico del proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador unico del volumen',
  })
  @ApiResponse({
    status: 200,
    description: 'Volumen eliminado exitosamente',
  })
  async remove(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.volumesService.remove(req.user.id, projectId, id);
  }
}
