import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction } from '../enums/audit-action.enum.js';
import { AuditResourceType } from '../enums/audit-resource-type.enum.js';

export class QueryAuditLogsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de proyecto asociado',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsOptional()
  @IsUUID('4', { message: 'projectId debe ser un UUID válido' })
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de acción ejecutada',
    enum: AuditAction,
    example: AuditAction.PROJECT_UPDATE,
  })
  @IsOptional()
  @IsEnum(AuditAction, {
    message: 'action debe ser una acción de auditoría válida',
  })
  action?: AuditAction;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de recurso afectado',
    enum: AuditResourceType,
    example: AuditResourceType.PROJECT,
  })
  @IsOptional()
  @IsEnum(AuditResourceType, {
    message: 'resourceType debe ser un tipo de recurso válido',
  })
  resourceType?: AuditResourceType;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de recurso',
    example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de usuario que ejecutó la acción',
    example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  @IsOptional()
  @IsUUID('4', { message: 'userId debe ser un UUID válido' })
  userId?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicial para filtrar registros (ISO 8601)',
    example: '2026-11-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final para filtrar registros (ISO 8601)',
    example: '2026-11-30T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Número de página para paginación',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de registros por página',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
