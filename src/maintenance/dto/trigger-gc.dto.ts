import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class TriggerGcDto {
  @ApiPropertyOptional({
    example: 24,
    description:
      'Antiguedad minima en horas para considerar un recurso como huerfano',
    default: 24,
  })
  @IsOptional()
  @IsInt({ message: 'olderThanHours debe ser un numero entero' })
  @Min(1, { message: 'El tiempo minimo es 1 hora' })
  @Max(720, { message: 'El tiempo maximo es 720 horas (30 dias)' })
  olderThanHours?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si se deben purgar imagenes Docker sin uso',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'pruneImages debe ser un valor booleano' })
  pruneImages?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si se deben purgar contenedores detenidos',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'pruneContainers debe ser un valor booleano' })
  pruneContainers?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'Indica si se deben purgar volumenes Docker anonimos o no usados',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'pruneVolumes debe ser un valor booleano' })
  pruneVolumes?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Indica si se deben eliminar carpetas temporales de compilacion antiguas',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'cleanWorkspaces debe ser un valor booleano' })
  cleanWorkspaces?: boolean;
}
