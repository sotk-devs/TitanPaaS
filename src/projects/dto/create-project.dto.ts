import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    example: 'my-web-app',
    description: 'Nombre del proyecto',
    minLength: 2,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  name: string;

  @ApiProperty({
    example: 'https://github.com/sotk-devs/sample-repo.git',
    description: 'URL del repositorio Git clonable',
  })
  @IsString({ message: 'La URL del repositorio debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La URL del repositorio es obligatoria' })
  repositoryUrl: string;

  @ApiProperty({
    example: 'sotk-devs/sample-repo',
    description: 'Identificador del repositorio (owner/repo)',
  })
  @IsString({ message: 'El identificador del repositorio debe ser una cadena' })
  @IsNotEmpty({ message: 'El identificador del repositorio es obligatorio' })
  repositoryName: string;

  @ApiPropertyOptional({
    example: 'main',
    description: 'Rama por defecto para los despliegues',
    default: 'main',
  })
  @IsOptional()
  @IsString({ message: 'La rama debe ser una cadena de texto' })
  branch?: string;

  @ApiPropertyOptional({
    example: 3000,
    description: 'Puerto interno del contenedor',
    default: 3000,
  })
  @IsOptional()
  @IsInt({ message: 'El puerto debe ser un número entero' })
  @Min(1, { message: 'El puerto mínimo es 1' })
  @Max(65535, { message: 'El puerto máximo es 65535' })
  port?: number;

  @ApiPropertyOptional({
    example: { NODE_ENV: 'production', PORT: '3000' },
    description: 'Variables de entorno para el despliegue',
    default: {},
  })
  @IsOptional()
  @IsObject({
    message: 'Las variables de entorno deben ser un objeto clave-valor',
  })
  envVariables?: Record<string, string>;
}
