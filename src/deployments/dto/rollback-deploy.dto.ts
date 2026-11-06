import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RollbackDeployDto {
  @ApiPropertyOptional({
    description: 'Motivo o justificación opcional para el rollback.',
    example: 'Regresión crítica detectada en el último despliegue',
  })
  @IsOptional()
  @IsString({ message: 'El motivo del rollback debe ser una cadena de texto.' })
  @MaxLength(255, {
    message: 'El motivo del rollback no puede exceder 255 caracteres.',
  })
  reason?: string;
}
