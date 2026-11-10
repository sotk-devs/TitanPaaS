import { ApiProperty } from '@nestjs/swagger';
import { ImportEnvMode } from './import-env.dto.js';

export class ImportEnvResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación de la operación',
    example: 'Variables de entorno importadas exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'Modo utilizado en la importación',
    enum: ImportEnvMode,
    example: ImportEnvMode.MERGE,
  })
  mode: ImportEnvMode;

  @ApiProperty({
    description:
      'Cantidad de variables parseadas e importadas del contenido recibido',
    example: 3,
  })
  importedCount: number;

  @ApiProperty({
    description:
      'Cantidad total de variables configuradas en el proyecto tras la importación',
    example: 5,
  })
  totalCount: number;

  @ApiProperty({
    description: 'Diccionario final de variables de entorno del proyecto',
    example: {
      PORT: '3000',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    },
  })
  variables: Record<string, string>;
}
