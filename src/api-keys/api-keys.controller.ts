import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiKeysService } from './api-keys.service.js';
import { RequireApiScopes } from './decorators/require-api-scopes.decorator.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { UpdateApiKeyDto } from './dto/update-api-key.dto.js';
import { ApiKeyScope } from './enums/api-key-scope.enum.js';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@ApiTags('API Keys')
@ApiBearerAuth()
@ApiSecurity('api-key')
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get('scopes')
  @ApiOperation({
    summary: 'Listar permisos (scopes) disponibles para API Keys',
  })
  @ApiResponse({
    status: 200,
    description: 'Catálogo de scopes disponibles.',
  })
  listScopes() {
    return this.apiKeysService.listAvailableScopes();
  }

  @Post()
  @RequireApiScopes(ApiKeyScope.API_KEYS_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generar una nueva API Key con permisos específicos',
  })
  @ApiResponse({
    status: 201,
    description:
      'API Key creada exitosamente. El token completo se devuelve una única vez.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado.',
  })
  create(@Request() req: RequestWithUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(req.user.id, dto);
  }

  @Get()
  @RequireApiScopes(ApiKeyScope.API_KEYS_MANAGE)
  @ApiOperation({ summary: 'Listar las API Keys del usuario autenticado' })
  @ApiQuery({
    name: 'includeRevoked',
    required: false,
    type: Boolean,
    description: 'Incluir llaves revocadas en el listado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de API Keys obtenida exitosamente.',
  })
  findAll(
    @Request() req: RequestWithUser,
    @Query('includeRevoked') includeRevoked?: string,
  ) {
    return this.apiKeysService.findAllByUser(
      req.user.id,
      includeRevoked === 'true',
    );
  }

  @Get(':id')
  @RequireApiScopes(ApiKeyScope.API_KEYS_MANAGE)
  @ApiOperation({ summary: 'Obtener detalle de una API Key por su ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la API Key.',
  })
  @ApiResponse({
    status: 404,
    description: 'API Key no encontrada.',
  })
  findOne(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.apiKeysService.findOneByUser(req.user.id, id);
  }

  @Patch(':id')
  @RequireApiScopes(ApiKeyScope.API_KEYS_MANAGE)
  @ApiOperation({
    summary: 'Actualizar nombre, permisos o expiración de una API Key',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'API Key actualizada exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'API Key no encontrada.',
  })
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.apiKeysService.update(req.user.id, id, dto);
  }

  @Post(':id/rotate')
  @RequireApiScopes(ApiKeyScope.API_KEYS_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotar una API Key generando un nuevo secreto inmediatamente',
  })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description:
      'API Key rotada exitosamente. El secreto anterior queda invalidado.',
  })
  @ApiResponse({
    status: 404,
    description: 'API Key no encontrada.',
  })
  rotate(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.apiKeysService.rotate(req.user.id, id);
  }

  @Delete(':id')
  @RequireApiScopes(ApiKeyScope.API_KEYS_MANAGE)
  @ApiOperation({ summary: 'Revocar o eliminar una API Key' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({
    name: 'permanent',
    required: false,
    type: Boolean,
    description: 'Si es true, elimina el registro de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'API Key revocada exitosamente.',
  })
  @ApiResponse({
    status: 404,
    description: 'API Key no encontrada.',
  })
  revoke(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('permanent') permanent?: string,
  ) {
    return this.apiKeysService.revoke(req.user.id, id, permanent === 'true');
  }
}
