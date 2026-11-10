import {
  Controller,
  Get,
  Post,
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
import { DomainsService } from './domains.service.js';
import { CreateCustomDomainDto } from './dto/create-custom-domain.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@ApiTags('Domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Post('projects/:projectId/domains')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar un nuevo dominio personalizado para un proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 201,
    description:
      'Dominio registrado exitosamente (inicia en PENDING o VERIFIED si pasó el chequeo DNS).',
  })
  @ApiResponse({
    status: 400,
    description: 'Formato de dominio inválido.',
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
  @ApiResponse({
    status: 409,
    description: 'El dominio ya se encuentra registrado en la plataforma.',
  })
  create(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() createCustomDomainDto: CreateCustomDomainDto,
  ) {
    return this.domainsService.create(
      req.user.id,
      projectId,
      createCustomDomainDto,
    );
  }

  @Get('projects/:projectId/domains')
  @ApiOperation({
    summary: 'Listar todos los dominios personalizados de un proyecto',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de dominios personalizada obtenida exitosamente.',
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
  findAllByProject(
    @Request() req: RequestWithUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.domainsService.findAllByProject(req.user.id, projectId);
  }

  @Get('domains/:id')
  @ApiOperation({
    summary: 'Obtener el detalle y estado de verificación de un dominio',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del dominio personalizado',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del dominio obtenido exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description:
      'Dominio personalizado no encontrado o no pertenece al usuario.',
  })
  findOne(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.domainsService.findOne(req.user.id, id);
  }

  @Post('domains/:id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reintentar o forzar la comprobación de registros DNS (CNAME/A) para un dominio',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del dominio personalizado',
  })
  @ApiResponse({
    status: 200,
    description: 'Comprobación DNS ejecutada y estado actualizado.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Dominio personalizado no encontrado.',
  })
  verify(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.domainsService.verify(req.user.id, id);
  }

  @Delete('domains/:id')
  @ApiOperation({
    summary: 'Eliminar un dominio personalizado de un proyecto',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Identificador único (UUID) del dominio personalizado',
  })
  @ApiResponse({
    status: 200,
    description: 'Dominio personalizado eliminado exitosamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  @ApiResponse({
    status: 404,
    description: 'Dominio personalizado no encontrado.',
  })
  remove(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.domainsService.remove(req.user.id, id);
  }
}
