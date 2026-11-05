import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deployment } from './entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentPaginationQueryDto } from './dto/deployment-pagination-query.dto.js';

export interface PaginatedDeployments {
  items: Deployment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class DeploymentsService {
  constructor(
    @InjectRepository(Deployment)
    private readonly deploymentRepository: Repository<Deployment>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async findByProject(
    userId: string,
    projectId: string,
    query?: DeploymentPaginationQueryDto,
  ): Promise<PaginatedDeployments> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto #${projectId} no encontrado o no pertenece al usuario autenticado.`,
      );
    }

    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 20));
    const skip = (page - 1) * limit;

    const [items, total] = await this.deploymentRepository.findAndCount({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(userId: string, id: string): Promise<Deployment> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id },
      relations: ['project'],
    });

    if (!deployment || deployment.project?.userId !== userId) {
      throw new NotFoundException(
        `Despliegue #${id} no encontrado o no pertenece a un proyecto del usuario autenticado.`,
      );
    }

    return deployment;
  }
}
