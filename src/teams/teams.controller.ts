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
import { TeamsService } from './teams.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { AddTeamMemberDto } from './dto/add-team-member.dto.js';
import { UpdateTeamMemberRoleDto } from './dto/update-team-member-role.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TeamRolesGuard } from './guards/team-roles.guard.js';
import { RequireTeamRoles } from './decorators/require-team-roles.decorator.js';
import { TeamRole } from './enums/team-role.enum.js';

interface RequestWithUser {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TeamRolesGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva organización / equipo' })
  @ApiResponse({
    status: 201,
    description: 'Equipo creado exitosamente con el usuario como Owner.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos.',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un equipo con ese slug.',
  })
  create(
    @Request() req: RequestWithUser,
    @Body() createTeamDto: CreateTeamDto,
  ) {
    return this.teamsService.create(req.user.id, createTeamDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar todos los equipos a los que pertenece el usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de equipos obtenida exitosamente.',
  })
  findAll(@Request() req: RequestWithUser) {
    return this.teamsService.findAllForUser(req.user.id);
  }

  @Get(':id')
  @RequireTeamRoles(
    TeamRole.OWNER,
    TeamRole.ADMIN,
    TeamRole.DEVELOPER,
    TeamRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Obtener detalle de un equipo y sus miembros',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del equipo',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del equipo obtenido exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para acceder al equipo.',
  })
  @ApiResponse({
    status: 404,
    description: 'Equipo no encontrado.',
  })
  findOne(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teamsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @RequireTeamRoles(TeamRole.OWNER, TeamRole.ADMIN)
  @ApiOperation({
    summary: 'Actualizar configuración de un equipo (Owner / Admin)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del equipo',
  })
  @ApiResponse({
    status: 200,
    description: 'Equipo actualizado exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente.',
  })
  update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTeamDto: UpdateTeamDto,
  ) {
    return this.teamsService.update(req.user.id, id, updateTeamDto);
  }

  @Delete(':id')
  @RequireTeamRoles(TeamRole.OWNER)
  @ApiOperation({ summary: 'Eliminar un equipo (solo Owner)' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del equipo',
  })
  @ApiResponse({
    status: 200,
    description: 'Equipo eliminado exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description: 'Solo el Owner puede eliminar el equipo.',
  })
  remove(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teamsService.remove(req.user.id, id);
  }

  @Get(':id/members')
  @RequireTeamRoles(
    TeamRole.OWNER,
    TeamRole.ADMIN,
    TeamRole.DEVELOPER,
    TeamRole.VIEWER,
  )
  @ApiOperation({ summary: 'Listar miembros del equipo y sus roles' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del equipo',
  })
  @ApiResponse({
    status: 200,
    description: 'Miembros obtenidos exitosamente.',
  })
  getMembers(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teamsService.getMembers(req.user.id, id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @RequireTeamRoles(TeamRole.OWNER, TeamRole.ADMIN)
  @ApiOperation({
    summary: 'Agregar un colaborador al equipo con rol RBAC (Owner / Admin)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del equipo',
  })
  @ApiResponse({
    status: 201,
    description: 'Miembro agregado al equipo exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description: 'Permisos insuficientes.',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario o equipo no encontrado.',
  })
  @ApiResponse({
    status: 409,
    description: 'El usuario ya es miembro del equipo.',
  })
  addMember(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() addMemberDto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(req.user.id, id, addMemberDto);
  }

  @Patch(':id/members/:userId')
  @RequireTeamRoles(TeamRole.OWNER, TeamRole.ADMIN)
  @ApiOperation({
    summary: 'Cambiar el rol RBAC de un miembro del equipo (Owner / Admin)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del equipo',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID del usuario miembro',
  })
  @ApiResponse({
    status: 200,
    description: 'Rol actualizado exitosamente.',
  })
  @ApiResponse({
    status: 403,
    description: 'Permisos insuficientes para cambiar el rol.',
  })
  updateMemberRole(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() updateRoleDto: UpdateTeamMemberRoleDto,
  ) {
    return this.teamsService.updateMemberRole(
      req.user.id,
      id,
      userId,
      updateRoleDto,
    );
  }

  @Delete(':id/members/:userId')
  @RequireTeamRoles(
    TeamRole.OWNER,
    TeamRole.ADMIN,
    TeamRole.DEVELOPER,
    TeamRole.VIEWER,
  )
  @ApiOperation({
    summary: 'Eliminar un miembro del equipo o abandonar el equipo',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del equipo',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID del usuario miembro',
  })
  @ApiResponse({
    status: 200,
    description: 'Miembro eliminado exitosamente.',
  })
  removeMember(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teamsService.removeMember(req.user.id, id, userId);
  }

  @Get(':id/projects')
  @RequireTeamRoles(
    TeamRole.OWNER,
    TeamRole.ADMIN,
    TeamRole.DEVELOPER,
    TeamRole.VIEWER,
  )
  @ApiOperation({ summary: 'Listar los proyectos pertenecientes al equipo' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'ID del equipo',
  })
  @ApiResponse({
    status: 200,
    description: 'Proyectos del equipo obtenidos exitosamente.',
  })
  getTeamProjects(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.teamsService.getTeamProjects(req.user.id, id);
  }
}
