import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiKeyScope } from '../enums/api-key-scope.enum.js';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'GitHub Actions CI/CD',
    description: 'Nombre descriptivo para identificar la API Key',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @ApiPropertyOptional({
    example: 'Token para despliegues automáticos desde GitHub Actions',
    description: 'Descripción opcional del propósito de esta API Key',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(255, {
    message: 'La descripción no puede exceder 255 caracteres',
  })
  description?: string;

  @ApiProperty({
    example: [ApiKeyScope.DEPLOYMENTS_WRITE, ApiKeyScope.PROJECTS_READ],
    enum: ApiKeyScope,
    isArray: true,
    description: 'Lista de permisos (scopes) asignados a esta API Key',
  })
  @IsArray({ message: 'scopes debe ser un arreglo de permisos' })
  @ArrayNotEmpty({ message: 'Debes especificar al menos un permiso (scope)' })
  @IsEnum(ApiKeyScope, {
    each: true,
    message: 'Uno o más scopes especificados no son válidos',
  })
  scopes: ApiKeyScope[];

  @ApiPropertyOptional({
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description:
      'IDs de proyectos a los que queda restringida la API Key (omitir para acceso a todos los proyectos del usuario)',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'allowedProjectIds debe ser un arreglo de UUIDs' })
  @IsUUID('4', {
    each: true,
    message: 'Cada ID de proyecto permitido debe ser un UUID válido',
  })
  allowedProjectIds?: string[];

  @ApiPropertyOptional({
    example: 90,
    description: 'Días hasta la expiración del token (1 a 3650 días)',
    minimum: 1,
    maximum: 3650,
  })
  @IsOptional()
  @IsInt({ message: 'expiresInDays debe ser un número entero' })
  @Min(1, { message: 'La expiración mínima es de 1 día' })
  @Max(3650, { message: 'La expiración máxima es de 3650 días' })
  expiresInDays?: number;

  @ApiPropertyOptional({
    example: '2027-01-01T00:00:00.000Z',
    description:
      'Fecha ISO 8601 explícita de expiración (alternativa a expiresInDays)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'expiresAt debe ser una fecha ISO 8601 válida' })
  expiresAt?: string;
}
