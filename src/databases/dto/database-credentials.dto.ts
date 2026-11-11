import { ApiProperty } from '@nestjs/swagger';

export class DatabaseCredentialsDto {
  @ApiProperty({
    example: 'titan_db_my_project_main_postgres',
    description:
      'Nombre de host del contenedor en la red privada titan-network',
  })
  host: string;

  @ApiProperty({
    example: 5432,
    description: 'Puerto interno del servicio de base de datos',
  })
  port: number;

  @ApiProperty({
    example: 'app_production',
    description: 'Nombre de base de datos',
    nullable: true,
  })
  databaseName: string | null;

  @ApiProperty({
    example: 'titan_user',
    description: 'Nombre de usuario de conexion',
    nullable: true,
  })
  username: string | null;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Contrasena de acceso',
  })
  password: string;

  @ApiProperty({
    example:
      'postgresql://titan_user:pass@titan_db_my_project_main_postgres:5432/app_production',
    description:
      'Cadena de conexion completa para usar dentro de titan-network',
  })
  connectionUrl: string;
}
