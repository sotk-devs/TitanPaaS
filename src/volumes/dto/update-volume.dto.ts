import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateVolumeDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Modificar modo de solo lectura del volumen',
  })
  @IsOptional()
  @IsBoolean({ message: 'readOnly debe ser un valor booleano' })
  readOnly?: boolean;

  @ApiPropertyOptional({
    example: '20GB',
    description: 'Actualizar capacidad estimada del volumen',
  })
  @IsOptional()
  @IsString({ message: 'size debe ser una cadena de texto' })
  size?: string;
}
