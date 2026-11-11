import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DatabaseType } from '../enums/database-type.enum.js';

export class CreateDatabaseDto {
  @ApiProperty({
    example: 'main-postgres',
    description: 'Nombre identificador de la base de datos dentro del proyecto',
  })
  @IsString()
  @MinLength(2, { message: 'El nombre debe contener al menos 2 caracteres' })
  @MaxLength(64, { message: 'El nombre no puede exceder 64 caracteres' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'El nombre solo puede contener letras, numeros, guiones y guiones bajos',
  })
  name: string;

  @ApiProperty({
    enum: DatabaseType,
    example: DatabaseType.POSTGRESQL,
    description:
      'Motor de base de datos a aprovisionar (postgres, mysql, redis)',
  })
  @IsEnum(DatabaseType, {
    message: 'Tipo de base de datos invalido. Debe ser postgres, mysql o redis',
  })
  type: DatabaseType;

  @ApiPropertyOptional({
    example: '16-alpine',
    description: 'Etiqueta de version de la imagen Docker oficial',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    example: 'app_production',
    description: 'Nombre de la base de datos a crear (no aplica para redis)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'El nombre de base de datos solo puede contener caracteres alfanumericos y guiones bajos',
  })
  databaseName?: string;

  @ApiPropertyOptional({
    example: 'titan_user',
    description: 'Nombre de usuario administrador (no aplica para redis)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'El nombre de usuario solo puede contener caracteres alfanumericos y guiones bajos',
  })
  username?: string;

  @ApiPropertyOptional({
    example: 'SecurePassword123!',
    description: 'Contrasena de acceso (se autogenera si no se proporciona)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  password?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Inyectar automaticamente la URL de conexion en las variables de entorno del proyecto',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoInjectEnv?: boolean;
}
