import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ClusterService } from './cluster.service.js';
import { InitClusterDto } from './dto/init-cluster.dto.js';
import { UpdateNodeDto } from './dto/update-node.dto.js';
import { DeploySwarmServiceDto } from './dto/deploy-swarm-service.dto.js';
import {
  ClusterNodeResponseDto,
  ClusterStatusResponseDto,
  JoinTokensResponseDto,
} from './dto/cluster-response.dto.js';
import type {
  ClusterNode,
  SwarmClusterStatus,
  SwarmJoinTokens,
  SwarmServiceResult,
} from './interfaces/cluster-node.interface.js';

@ApiTags('Cluster & Multi-Node')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cluster')
export class ClusterController {
  constructor(private readonly clusterService: ClusterService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Obtener estado general del cluster Docker Swarm',
    description:
      'Verifica si el nodo actual opera como manager o worker en un cluster Swarm, junto con la cantidad de nodos conectados.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Estado de Docker Swarm obtenido correctamente',
    type: ClusterStatusResponseDto,
  })
  async getStatus(): Promise<SwarmClusterStatus> {
    return this.clusterService.getClusterStatus();
  }

  @Post('init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicializar cluster Docker Swarm en este servidor',
    description:
      'Convierte este servidor en el manager principal del cluster e inicializa la red overlay titan-overlay.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cluster inicializado exitosamente',
  })
  async initCluster(
    @Body() dto: InitClusterDto,
  ): Promise<{ message: string; status: SwarmClusterStatus }> {
    return this.clusterService.initCluster(dto);
  }

  @Get('join-tokens')
  @ApiOperation({
    summary:
      'Obtener tokens y comandos para conectar nuevos servidores al cluster',
    description:
      'Retorna los comandos bash necesarios para aprovisionar y unir servidores VPS adicionales como workers o managers.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tokens y comandos de union obtenidos exitosamente',
    type: JoinTokensResponseDto,
  })
  async getJoinTokens(): Promise<SwarmJoinTokens> {
    return this.clusterService.getJoinTokens();
  }

  @Get('nodes')
  @ApiOperation({
    summary: 'Listar todos los nodos servidores conectados al cluster',
    description:
      'Retorna el listado de servidores manager y workers conectados, su estado operativo y disponibilidad.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de nodos obtenida correctamente',
    type: [ClusterNodeResponseDto],
  })
  async listNodes(): Promise<ClusterNode[]> {
    return this.clusterService.listNodes();
  }

  @Get('nodes/:id')
  @ApiOperation({
    summary: 'Inspeccionar detalles de un nodo especifico del cluster',
  })
  @ApiParam({ name: 'id', description: 'ID o hostname del nodo servidor' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detalles del nodo obtenidos correctamente',
    type: ClusterNodeResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Nodo no encontrado en el cluster',
  })
  async getNode(@Param('id') id: string): Promise<ClusterNode> {
    return this.clusterService.getNode(id);
  }

  @Patch('nodes/:id')
  @ApiOperation({
    summary: 'Actualizar disponibilidad o etiquetas de colocacion de un nodo',
    description:
      'Permite drenar un nodo para mantenimiento (drain), pausarlo o etiquetarlo para afinidad de despliegue.',
  })
  @ApiParam({ name: 'id', description: 'ID o hostname del nodo servidor' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Nodo actualizado exitosamente',
  })
  async updateNode(
    @Param('id') id: string,
    @Body() dto: UpdateNodeDto,
  ): Promise<{ message: string; node: ClusterNode }> {
    return this.clusterService.updateNode(id, dto);
  }

  @Delete('nodes/:id')
  @ApiOperation({
    summary: 'Remover un servidor worker del cluster Swarm',
  })
  @ApiParam({ name: 'id', description: 'ID o hostname del nodo servidor' })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Servidor removido del cluster',
  })
  async removeNode(
    @Param('id') id: string,
    @Query('force') force?: string,
  ): Promise<{ message: string }> {
    const isForce = force === 'true' || force === '1';
    return this.clusterService.removeNode(id, isForce);
  }

  @Post('leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Desconectar este servidor del cluster Docker Swarm',
  })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Servidor desconectado del cluster',
  })
  async leaveCluster(
    @Query('force') force?: string,
  ): Promise<{ message: string }> {
    const isForce = force === 'true' || force === '1';
    return this.clusterService.leaveCluster(isForce);
  }

  @Post('services')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Desplegar o actualizar un servicio distribuido en los workers del cluster',
    description:
      'Crea un servicio Docker Swarm replicado y distribuido entre servidores worker con enrutamiento de Traefik.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Servicio Swarm desplegado correctamente',
  })
  async deployService(
    @Body() dto: DeploySwarmServiceDto,
  ): Promise<SwarmServiceResult> {
    return this.clusterService.deployService(dto);
  }

  @Delete('services/:name')
  @ApiOperation({
    summary: 'Eliminar un servicio del cluster Swarm',
  })
  @ApiParam({ name: 'name', description: 'Nombre del servicio a remover' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Servicio eliminado del cluster',
  })
  async removeService(
    @Param('name') name: string,
  ): Promise<{ message: string }> {
    return this.clusterService.removeService(name);
  }
}
