import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVolumeDto {
  @ApiProperty({
    example: 'uploads-data',
    description: 'Nombre descriptivo del volumen para el proyecto',
    minLength: 2,
    maxLength: 64,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(64, { message: 'El nombre no puede exceder 64 caracteres' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'El nombre solo puede contener letras, numeros, guiones y guiones bajos',
  })
  name: string;

  @ApiProperty({
    example: '/app/uploads',
    description:
      'Ruta absoluta dentro del contenedor donde se montara el volumen',
  })
  @IsString({ message: 'La ruta de montaje debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La ruta de montaje es obligatoria' })
  @Matches(/^\/([a-zA-Z0-9_\-.]+\/?)*[a-zA-Z0-9_\-.]+$/, {
    message:
      'La ruta de montaje debe ser una ruta absoluta valida (ej. /app/data)',
  })
  mountPath: string;

  @ApiPropertyOptional({
    example: false,
    description:
      'Indica si el volumen debe montarse en modo de solo lectura (:ro)',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'readOnly debe ser un valor booleano' })
  readOnly?: boolean;

  @ApiPropertyOptional({
    example: '10GB',
    description: 'Capacidad o limite estimado del volumen (informativo)',
  })
  @IsOptional()
  @IsString({ message: 'El tamano debe ser una cadena de texto' })
  size?: string;
}
