import {
  IsString,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeploySwarmServiceDto {
  @ApiProperty({
    description: 'Nombre unico del servicio en el cluster Swarm',
    example: 'my-app-service',
  })
  @IsString()
  serviceName: string;

  @ApiProperty({
    description: 'Tag o imagen de Docker para desplegar',
    example: 'titanpaas/app:v1.0.0',
  })
  @IsString()
  imageTag: string;

  @ApiPropertyOptional({
    description:
      'Numero de replicas o instancias del contenedor distribuidas entre los workers',
    example: 3,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  replicas?: number;

  @ApiProperty({
    description: 'Puerto expuesto por el contenedor para enrutamiento',
    example: 3000,
  })
  @IsNumber()
  port: number;

  @ApiPropertyOptional({
    description:
      'Restricciones de colocacion en el cluster (ej: ["node.role == worker", "node.labels.region == us-east"])',
    example: ['node.role == worker'],
  })
  @IsOptional()
  @IsArray()
  placementConstraints?: string[];

  @ApiPropertyOptional({
    description: 'Variables de entorno inyectadas al servicio',
    example: { NODE_ENV: 'production' },
  })
  @IsOptional()
  @IsObject()
  envVariables?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Subdominio para enrutamiento automatico con Traefik',
    example: 'my-app',
  })
  @IsOptional()
  @IsString()
  subdomain?: string;

  @ApiPropertyOptional({
    description: 'Limite maximo de CPUs asignadas a cada replica',
    example: 1.5,
  })
  @IsOptional()
  @IsNumber()
  cpuLimit?: number;

  @ApiPropertyOptional({
    description: 'Limite maximo de memoria para cada replica (ej: 512M, 1G)',
    example: '1G',
  })
  @IsOptional()
  @IsString()
  memoryLimit?: string;
}
