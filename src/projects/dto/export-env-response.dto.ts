import { ApiProperty } from '@nestjs/swagger';

export class ExportEnvResponseDto {
  @ApiProperty({
    description: 'Contenido completo en formato texto plano .env',
    example:
      'DATABASE_URL="postgresql://user:pass@localhost:5432/db"\nNODE_ENV=production\nPORT=3000\n',
  })
  raw: string;

  @ApiProperty({
    description: 'Diccionario de variables de entorno descifradas',
    example: {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      NODE_ENV: 'production',
      PORT: '3000',
    },
  })
  variables: Record<string, string>;

  @ApiProperty({
    description: 'Cantidad de variables exportadas',
    example: 3,
  })
  count: number;
}
