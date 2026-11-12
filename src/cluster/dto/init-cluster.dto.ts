import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InitClusterDto {
  @ApiPropertyOptional({
    description:
      'Direccion IP anunciada para comunicarse con otros nodos del cluster',
    example: '192.168.1.100',
  })
  @IsOptional()
  @IsString()
  advertiseAddr?: string;

  @ApiPropertyOptional({
    description:
      'Direccion de escucha para administracion del cluster (por defecto 0.0.0.0:2377)',
    example: '0.0.0.0:2377',
  })
  @IsOptional()
  @IsString()
  listenAddr?: string;

  @ApiPropertyOptional({
    description:
      'Forzar creacion de un cluster nuevo recuperando el estado si es necesario',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  forceNewCluster?: boolean;
}
