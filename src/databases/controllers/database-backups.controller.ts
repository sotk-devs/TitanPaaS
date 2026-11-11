import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { DatabaseBackupsService } from '../services/database-backups.service.js';
import { UpdateBackupScheduleDto } from '../dto/update-backup-schedule.dto.js';
import { DatabaseBackup } from '../entities/database-backup.entity.js';
import { BackupSchedule } from '../entities/backup-schedule.entity.js';

@ApiTags('Database Backups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/databases/:databaseId')
export class DatabaseBackupsController {
  constructor(private readonly backupsService: DatabaseBackupsService) {}

  @Post('backups')
  @ApiOperation({
    summary:
      'Crear un respaldo manual inmediato de la base de datos y almacenarlo en S3/MinIO',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'databaseId',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 201,
    description: 'Respaldo generado y subido exitosamente',
    type: DatabaseBackup,
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 404, description: 'Base de datos no encontrada' })
  createBackup(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('databaseId', ParseUUIDPipe) databaseId: string,
  ): Promise<DatabaseBackup> {
    return this.backupsService.createBackup(req.user.id, projectId, databaseId);
  }

  @Get('backups')
  @ApiOperation({
    summary:
      'Listar el historial de respaldos almacenados para la base de datos',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'databaseId',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de respaldos',
    type: [DatabaseBackup],
  })
  findAllBackups(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('databaseId', ParseUUIDPipe) databaseId: string,
  ): Promise<DatabaseBackup[]> {
    return this.backupsService.findAllByDatabase(
      req.user.id,
      projectId,
      databaseId,
    );
  }

  @Get('backups/:backupId')
  @ApiOperation({
    summary: 'Consultar detalles de un respaldo especifico',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'databaseId',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiParam({
    name: 'backupId',
    type: 'string',
    description: 'UUID del respaldo',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle del respaldo',
    type: DatabaseBackup,
  })
  @ApiResponse({ status: 404, description: 'Respaldo no encontrado' })
  findOneBackup(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('databaseId', ParseUUIDPipe) databaseId: string,
    @Param('backupId', ParseUUIDPipe) backupId: string,
  ): Promise<DatabaseBackup> {
    return this.backupsService.findOneBackup(
      req.user.id,
      projectId,
      databaseId,
      backupId,
    );
  }

  @Post('backups/:backupId/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Restaurar la base de datos con un solo clic a partir de un respaldo almacenado en S3/MinIO',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'databaseId',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiParam({
    name: 'backupId',
    type: 'string',
    description: 'UUID del respaldo a restaurar',
  })
  @ApiResponse({
    status: 200,
    description: 'Restauracion completada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'El respaldo no se encuentra completado',
  })
  @ApiResponse({ status: 404, description: 'Respaldo no encontrado' })
  restoreBackup(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('databaseId', ParseUUIDPipe) databaseId: string,
    @Param('backupId', ParseUUIDPipe) backupId: string,
  ): Promise<{ message: string; backup: DatabaseBackup }> {
    return this.backupsService.restoreBackup(
      req.user.id,
      projectId,
      databaseId,
      backupId,
    );
  }

  @Delete('backups/:backupId')
  @ApiOperation({
    summary: 'Eliminar un respaldo de la base de datos y purgarlo de S3/MinIO',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'databaseId',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiParam({
    name: 'backupId',
    type: 'string',
    description: 'UUID del respaldo',
  })
  @ApiResponse({
    status: 200,
    description:
      'Respaldo eliminado de la base de datos y del almacenamiento S3',
  })
  deleteBackup(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('databaseId', ParseUUIDPipe) databaseId: string,
    @Param('backupId', ParseUUIDPipe) backupId: string,
  ): Promise<{ message: string }> {
    return this.backupsService.deleteBackup(
      req.user.id,
      projectId,
      databaseId,
      backupId,
    );
  }

  @Get('schedule')
  @ApiOperation({
    summary:
      'Consultar la programacion de respaldos automaticos de la base de datos',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'databaseId',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuracion de la programacion de respaldos',
    type: BackupSchedule,
  })
  getSchedule(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('databaseId', ParseUUIDPipe) databaseId: string,
  ): Promise<BackupSchedule> {
    return this.backupsService.getSchedule(req.user.id, projectId, databaseId);
  }

  @Put('schedule')
  @ApiOperation({
    summary:
      'Crear o actualizar la programacion automatica de respaldos y retencion',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'databaseId',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Programacion actualizada exitosamente',
    type: BackupSchedule,
  })
  updateSchedule(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('databaseId', ParseUUIDPipe) databaseId: string,
    @Body() dto: UpdateBackupScheduleDto,
  ): Promise<BackupSchedule> {
    return this.backupsService.updateSchedule(
      req.user.id,
      projectId,
      databaseId,
      dto,
    );
  }

  @Delete('schedule')
  @ApiOperation({
    summary: 'Eliminar o pausar la programacion de respaldos',
  })
  @ApiParam({
    name: 'projectId',
    type: 'string',
    description: 'UUID del proyecto',
  })
  @ApiParam({
    name: 'databaseId',
    type: 'string',
    description: 'UUID de la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'Programacion eliminada exitosamente',
  })
  deleteSchedule(
    @Request() req: any,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('databaseId', ParseUUIDPipe) databaseId: string,
  ): Promise<{ message: string }> {
    return this.backupsService.deleteSchedule(
      req.user.id,
      projectId,
      databaseId,
    );
  }
}
