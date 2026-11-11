import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    example: 'my-web-app',
    description: 'Nombre del proyecto',
    minLength: 2,
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  name: string;

  @ApiProperty({
    example: 'https://github.com/sotk-devs/sample-repo.git',
    description: 'URL del repositorio Git clonable',
  })
  @IsString({ message: 'La URL del repositorio debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La URL del repositorio es obligatoria' })
  repositoryUrl: string;

  @ApiProperty({
    example: 'sotk-devs/sample-repo',
    description: 'Identificador del repositorio (owner/repo)',
  })
  @IsString({ message: 'El identificador del repositorio debe ser una cadena' })
  @IsNotEmpty({ message: 'El identificador del repositorio es obligatorio' })
  repositoryName: string;

  @ApiPropertyOptional({
    example: 'main',
    description: 'Rama por defecto para los despliegues',
    default: 'main',
  })
  @IsOptional()
  @IsString({ message: 'La rama debe ser una cadena de texto' })
  branch?: string;

  @ApiPropertyOptional({
    example: 3000,
    description: 'Puerto interno del contenedor',
    default: 3000,
  })
  @IsOptional()
  @IsInt({ message: 'El puerto debe ser un número entero' })
  @Min(1, { message: 'El puerto mínimo es 1' })
  @Max(65535, { message: 'El puerto máximo es 65535' })
  port?: number;

  @ApiPropertyOptional({
    example: { NODE_ENV: 'production', PORT: '3000' },
    description: 'Variables de entorno para el despliegue',
    default: {},
  })
  @IsOptional()
  @IsObject({
    message: 'Las variables de entorno deben ser un objeto clave-valor',
  })
  envVariables?: Record<string, string>;

  @ApiPropertyOptional({
    example: 1.0,
    description: 'Límite de CPU en núcleos (ej. 0.5, 1.0, 2.0)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'El límite de CPU debe ser un número válido' })
  @Min(0.1, { message: 'El límite mínimo de CPU es 0.1' })
  @Max(64, { message: 'El límite máximo de CPU es 64' })
  cpuLimit?: number;

  @ApiPropertyOptional({
    example: '512m',
    description: 'Límite de memoria RAM (ej. 256m, 512m, 1g, 2g)',
  })
  @IsOptional()
  @IsString({ message: 'El límite de memoria debe ser una cadena de texto' })
  @Matches(/^\d+(m|g|k|b)?$/i, {
    message: 'memoryLimit debe ser un valor válido (ej: 256m, 512m, 1g)',
  })
  memoryLimit?: string;

  @ApiPropertyOptional({
    example: '1g',
    description: 'Límite total de memoria + swap (ej. 512m, 1g, 2g)',
  })
  @IsOptional()
  @IsString({ message: 'El límite de swap debe ser una cadena de texto' })
  @Matches(/^\d+(m|g|k|b)?$/i, {
    message: 'memorySwap debe ser un valor válido (ej: 512m, 1g, 2g)',
  })
  memorySwap?: string;

  @ApiPropertyOptional({
    example: '/healthz',
    description: 'Ruta HTTP para verificar la salud del contenedor',
  })
  @IsOptional()
  @IsString({ message: 'La ruta de healthcheck debe ser una cadena de texto' })
  healthcheckPath?: string;

  @ApiPropertyOptional({
    example: 200,
    description: 'Código de estado HTTP esperado',
    default: 200,
  })
  @IsOptional()
  @IsInt({
    message: 'El código de respuesta esperado debe ser un número entero',
  })
  @Min(100, { message: 'El código HTTP mínimo es 100' })
  @Max(599, { message: 'El código HTTP máximo es 599' })
  healthcheckExpectedStatus?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Timeout en segundos por intento de healthcheck',
    default: 5,
  })
  @IsOptional()
  @IsInt({ message: 'El timeout debe ser un número entero' })
  @Min(1, { message: 'El timeout mínimo es 1 segundo' })
  @Max(300, { message: 'El timeout máximo es 300 segundos' })
  healthcheckTimeout?: number;

  @ApiPropertyOptional({
    example: 3,
    description: 'Número máximo de reintentos de healthcheck',
    default: 3,
  })
  @IsOptional()
  @IsInt({ message: 'Los reintentos deben ser un número entero' })
  @Min(1, { message: 'Mínimo 1 reintento' })
  @Max(30, { message: 'Máximo 30 reintentos' })
  healthcheckRetries?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'Activa o desactiva la protección de rate limiting y DDoS en Traefik',
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'rateLimitEnabled debe ser un booleano' })
  rateLimitEnabled?: boolean;

  @ApiPropertyOptional({
    example: 100,
    description: 'Tasa media máxima de peticiones por segundo (req/s)',
    default: 100,
  })
  @IsOptional()
  @IsInt({ message: 'rateLimitAverage debe ser un entero' })
  @Min(1, { message: 'El promedio mínimo es 1 petición por segundo' })
  @Max(100000, {
    message: 'El promedio máximo es 100000 peticiones por segundo',
  })
  rateLimitAverage?: number;

  @ApiPropertyOptional({
    example: 50,
    description:
      'Ráfaga máxima de peticiones permitidas antes de aplicar limitación',
    default: 50,
  })
  @IsOptional()
  @IsInt({ message: 'rateLimitBurst debe ser un entero' })
  @Min(1, { message: 'El burst mínimo es 1' })
  @Max(50000, { message: 'El burst máximo es 50000' })
  rateLimitBurst?: number;

  @ApiPropertyOptional({
    example: '1s',
    description: 'Periodo de cálculo para la tasa media (ej. 1s, 1m)',
    default: '1s',
  })
  @IsOptional()
  @IsString({ message: 'rateLimitPeriod debe ser una cadena de texto' })
  @Matches(/^\d+[smh]$/, {
    message:
      'rateLimitPeriod debe ser un formato de tiempo válido (ej. 1s, 1m)',
  })
  rateLimitPeriod?: string;

  @ApiPropertyOptional({
    example: 50,
    description:
      'Límite de conexiones concurrentes en vuelo (inflight requests) para mitigar DDoS',
  })
  @IsOptional()
  @IsInt({ message: 'maxConcurrentConnections debe ser un entero' })
  @Min(1, { message: 'El mínimo de conexiones concurrentes es 1' })
  @Max(10000, { message: 'El máximo de conexiones concurrentes es 10000' })
  maxConcurrentConnections?: number;
}
