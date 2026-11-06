import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TriggerDeployDto {
  @ApiPropertyOptional({
    description:
      'Rama de Git a desplegar. Si no se especifica, se utiliza la rama configurada por defecto en el proyecto.',
    example: 'main',
  })
  @IsOptional()
  @IsString({ message: 'La rama debe ser una cadena de texto válida.' })
  @MaxLength(100, {
    message: 'El nombre de la rama no puede exceder 100 caracteres.',
  })
  branch?: string;

  @ApiPropertyOptional({
    description:
      'SHA del commit específico a desplegar. Si no se especifica, se despliega el commit más reciente (HEAD).',
    example: '7a5c4e9',
  })
  @IsOptional()
  @IsString({ message: 'El commit SHA debe ser una cadena de texto válida.' })
  @MaxLength(64, {
    message: 'El commit SHA no puede exceder 64 caracteres.',
  })
  commitSha?: string;

  @ApiPropertyOptional({
    description:
      'Mensaje descriptivo opcional para identificar el despliegue manual.',
    example: 'Manual deploy triggered via API',
  })
  @IsOptional()
  @IsString({ message: 'El mensaje del commit debe ser una cadena de texto.' })
  @MaxLength(255, {
    message: 'El mensaje del commit no puede exceder 255 caracteres.',
  })
  commitMessage?: string;
}
