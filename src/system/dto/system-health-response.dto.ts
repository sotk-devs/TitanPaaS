import { ApiProperty } from '@nestjs/swagger';

export class ServiceHealthDto {
  @ApiProperty({
    example: 'up',
    enum: ['up', 'down', 'degraded'],
    description: 'Estado de disponibilidad del servicio',
  })
  status: string;

  @ApiProperty({
    example: 12,
    required: false,
    description: 'Latencia de respuesta en milisegundos',
  })
  latencyMs?: number;

  @ApiProperty({
    example: 'Service is responding normally',
    required: false,
    description: 'Mensaje descriptivo o error en caso de fallo',
  })
  message?: string;
}

export class ServicesHealthMapDto {
  @ApiProperty({ type: ServiceHealthDto })
  database: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  redis: ServiceHealthDto;

  @ApiProperty({ type: ServiceHealthDto })
  docker: ServiceHealthDto;
}

export class SystemHealthResponseDto {
  @ApiProperty({
    example: 'healthy',
    enum: ['healthy', 'degraded', 'unhealthy'],
    description: 'Estado de salud global del cluster TitanPaaS',
  })
  status: string;

  @ApiProperty({
    example: '2026-11-12T16:50:00.000Z',
    description: 'Fecha y hora en formato ISO 8601',
  })
  timestamp: string;

  @ApiProperty({
    example: 12450.5,
    description: 'Tiempo de actividad del proceso en segundos',
  })
  uptime: number;

  @ApiProperty({ type: ServicesHealthMapDto })
  services: ServicesHealthMapDto;
}
