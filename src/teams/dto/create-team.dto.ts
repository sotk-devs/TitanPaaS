import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeamDto {
  @ApiProperty({
    example: 'Backend Platform Team',
    description: 'Nombre del equipo u organización',
    minLength: 2,
  })
  @IsString({ message: 'El nombre del equipo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del equipo es obligatorio' })
  @MinLength(2, {
    message: 'El nombre del equipo debe tener al menos 2 caracteres',
  })
  @MaxLength(80, {
    message: 'El nombre del equipo no puede exceder 80 caracteres',
  })
  name: string;

  @ApiPropertyOptional({
    example: 'backend-platform-team',
    description: 'Identificador único legible (slug) del equipo',
  })
  @IsOptional()
  @IsString({ message: 'El slug debe ser una cadena de texto' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'El slug solo puede contener letras minúsculas, números y guiones medios',
  })
  slug?: string;

  @ApiPropertyOptional({
    example: 'Equipo encargado de los microservicios y despliegues core',
    description: 'Descripción opcional del equipo',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(300, {
    message: 'La descripción no puede exceder 300 caracteres',
  })
  description?: string;
}
