import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ClusterStatusResponseDto {
  @ApiProperty({
    example: true,
    description: 'Indica si Docker Swarm esta activo en el host',
  })
  isActive: boolean;

  @ApiPropertyOptional({
    example: '2m6e1...nodeId',
    description: 'ID del nodo actual',
  })
  nodeId?: string;

  @ApiPropertyOptional({
    example: 'manager',
    enum: ['manager', 'worker'],
    description: 'Rol del nodo en el cluster',
  })
  nodeRole?: string;

  @ApiProperty({
    example: true,
    description: 'Indica si este nodo tiene privilegios de manager',
  })
  isManager: boolean;

  @ApiProperty({
    example: 3,
    description: 'Total de nodos conectados al cluster',
  })
  nodesCount: number;

  @ApiProperty({ example: 1, description: 'Total de managers activos' })
  managersCount: number;

  @ApiPropertyOptional({
    example: '192.168.1.10:2377',
    description: 'Direccion anunciada para el cluster',
  })
  advertiseAddr?: string;
}

export class JoinTokensResponseDto {
  @ApiProperty({
    example: 'SWMTKN-1-...workerToken',
    description: 'Token para unir nuevos servidores worker',
  })
  workerToken: string;

  @ApiProperty({
    example: 'SWMTKN-1-...managerToken',
    description: 'Token para unir managers secundarios',
  })
  managerToken: string;

  @ApiProperty({
    example: 'docker swarm join --token SWMTKN-1-... 192.168.1.10:2377',
    description: 'Comando bash completo para conectar un worker',
  })
  workerCommand: string;

  @ApiProperty({
    example: 'docker swarm join --token SWMTKN-1-... 192.168.1.10:2377',
    description: 'Comando bash completo para conectar un manager',
  })
  managerCommand: string;
}

export class ClusterNodeResponseDto {
  @ApiProperty({ example: 'node-id-123' })
  id: string;

  @ApiProperty({ example: 'worker-vps-1' })
  hostname: string;

  @ApiProperty({ example: 'worker', enum: ['manager', 'worker'] })
  role: string;

  @ApiProperty({ example: 'ready', enum: ['ready', 'down', 'unknown'] })
  status: string;

  @ApiProperty({ example: 'active', enum: ['active', 'pause', 'drain'] })
  availability: string;

  @ApiProperty({ example: false })
  isLeader: boolean;

  @ApiProperty({ example: '26.1.1' })
  engineVersion: string;

  @ApiPropertyOptional({ example: '192.168.1.20' })
  ipAddress?: string;

  @ApiPropertyOptional({ example: { region: 'us-east' } })
  labels?: Record<string, string>;
}
