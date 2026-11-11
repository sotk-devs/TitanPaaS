import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum ImportEnvMode {
  MERGE = 'merge',
  REPLACE = 'replace',
}

export class ImportEnvDto {
  @ApiProperty({
    description:
      'Contenido en formato texto plano del archivo .env (ej. KEY=VALUE por línea)',
    example:
      'PORT=3000\nDATABASE_URL=postgresql://user:pass@localhost:5432/db\nNODE_ENV=production',
  })
  @IsString({
    message: 'El contenido del archivo .env debe ser una cadena de texto',
  })
  @IsNotEmpty({ message: 'El contenido a importar no puede estar vacío' })
  content: string;

  @ApiPropertyOptional({
    description:
      'Modo de importación: "merge" combina con las variables existentes sobrescribiendo duplicados; "replace" reemplaza todas las variables existentes.',
    enum: ImportEnvMode,
    default: ImportEnvMode.MERGE,
    example: ImportEnvMode.MERGE,
  })
  @IsOptional()
  @IsEnum(ImportEnvMode, {
    message: 'El modo de importación debe ser "merge" o "replace"',
  })
  mode?: ImportEnvMode = ImportEnvMode.MERGE;
}
