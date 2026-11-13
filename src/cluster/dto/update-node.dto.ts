import { IsOptional, IsIn, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNodeDto {
  @ApiPropertyOptional({
    description:
      'Disponibilidad del nodo en el cluster (active: recibe tareas, pause: mantiene existentes pero no recibe nuevas, drain: reubica tareas en otros workers)',
    enum: ['active', 'pause', 'drain'],
    example: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'pause', 'drain'])
  availability?: 'active' | 'pause' | 'drain';

  @ApiPropertyOptional({
    description:
      'Etiquetas personalizadas para el nodo utilizadas en reglas de colocacion (placement constraints)',
    example: { role: 'frontend', region: 'us-east' },
  })
  @IsOptional()
  @IsObject()
  labels?: Record<string, string>;
}
