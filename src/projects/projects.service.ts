import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { DeploymentStatus } from '../deployments/enums/deployment-status.enum.js';
import { DomainStatus } from '../domains/enums/domain-status.enum.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';

export interface ContainerActionResponse {
  projectId: string;
  containerName: string;
  action: 'stop' | 'start' | 'restart';
  status: 'stopped' | 'running';
  message: string;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Deployment)
    private readonly deploymentRepository: Repository<Deployment>,
    private readonly dockerPipeline: DockerPipelineService,
  ) {}

  async create(
    userId: string,
    createProjectDto: CreateProjectDto,
  ): Promise<Project> {
    const normalizedName = createProjectDto.name.trim();

    const existingProject = await this.projectRepository.findOne({
      where: { name: normalizedName, userId },
    });

    if (existingProject) {
      throw new ConflictException(
        `Ya tienes un proyecto con el nombre "${normalizedName}"`,
      );
    }

    const project = this.projectRepository.create({
      ...createProjectDto,
      name: normalizedName,
      branch: createProjectDto.branch || 'main',
      port: createProjectDto.port || 3000,
      envVariables: createProjectDto.envVariables || {},
      userId,
    });

    return this.projectRepository.save(project);
  }

  async findAll(userId: string): Promise<Project[]> {
    return this.projectRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id, userId },
      relations: ['deployments', 'customDomains'],
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID "${id}" no encontrado`);
    }

    return project;
  }

  async update(
    userId: string,
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findOne(userId, id);

    if (
      updateProjectDto.name &&
      updateProjectDto.name.trim() !== project.name
    ) {
      const normalizedName = updateProjectDto.name.trim();
      const duplicate = await this.projectRepository.findOne({
        where: { name: normalizedName, userId },
      });

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `Ya tienes un proyecto con el nombre "${normalizedName}"`,
        );
      }

      project.name = normalizedName;
    }

    if (updateProjectDto.repositoryUrl !== undefined) {
      project.repositoryUrl = updateProjectDto.repositoryUrl;
    }

    if (updateProjectDto.repositoryName !== undefined) {
      project.repositoryName = updateProjectDto.repositoryName;
    }

    if (updateProjectDto.branch !== undefined) {
      project.branch = updateProjectDto.branch;
    }

    if (updateProjectDto.port !== undefined) {
      project.port = updateProjectDto.port;
    }

    const envVariablesUpdated = updateProjectDto.envVariables !== undefined;
    if (envVariablesUpdated) {
      project.envVariables = updateProjectDto.envVariables!;
    }

    if (updateProjectDto.rateLimitEnabled !== undefined) {
      project.rateLimitEnabled = updateProjectDto.rateLimitEnabled;
    }

    if (updateProjectDto.rateLimitAverage !== undefined) {
      project.rateLimitAverage = updateProjectDto.rateLimitAverage;
    }

    if (updateProjectDto.rateLimitBurst !== undefined) {
      project.rateLimitBurst = updateProjectDto.rateLimitBurst;
    }

    if (updateProjectDto.rateLimitPeriod !== undefined) {
      project.rateLimitPeriod = updateProjectDto.rateLimitPeriod;
    }

    if (updateProjectDto.maxConcurrentConnections !== undefined) {
      project.maxConcurrentConnections =
        updateProjectDto.maxConcurrentConnections;
    }

    const rateLimitUpdated =
      updateProjectDto.rateLimitEnabled !== undefined ||
      updateProjectDto.rateLimitAverage !== undefined ||
      updateProjectDto.rateLimitBurst !== undefined ||
      updateProjectDto.rateLimitPeriod !== undefined ||
      updateProjectDto.maxConcurrentConnections !== undefined;

    // Si se modificaron variables de entorno o rate limiting, recrear el contenedor en caliente si está desplegado
    if (envVariablesUpdated || rateLimitUpdated) {
      const containerName = this.dockerPipeline.generateContainerName(
        project.repositoryName,
      );
      const containerStatus =
        await this.dockerPipeline.getContainerStatus(containerName);

      const latestDeployment = await this.deploymentRepository.findOne({
        where: {
          projectId: project.id,
          status: DeploymentStatus.DEPLOYED,
        },
        order: { finishedAt: 'DESC' },
      });

      if (latestDeployment && containerStatus !== 'not_found') {
        const imageTag = this.dockerPipeline.generateImageTag(
          project.repositoryName,
          latestDeployment.commitSha || 'latest',
        );
        const subdomain = this.dockerPipeline.generateSubdomain(project.name);
        const verifiedDomains =
          project.customDomains
            ?.filter((d) => d.status === DomainStatus.VERIFIED)
            .map((d) => d.domain) || [];
        const network = process.env.TRAEFIK_NETWORK || 'titan-network';

        const rateLimit =
          project.rateLimitEnabled || project.maxConcurrentConnections
            ? {
                enabled: project.rateLimitEnabled,
                average: project.rateLimitAverage ?? undefined,
                burst: project.rateLimitBurst ?? undefined,
                period: project.rateLimitPeriod ?? undefined,
                maxConcurrentConnections:
                  project.maxConcurrentConnections ?? undefined,
              }
            : undefined;

        try {
          const runResult = await this.dockerPipeline.runContainer(
            imageTag,
            containerName,
            project.port,
            project.envVariables,
            {
              subdomain,
              network,
              customDomains: verifiedDomains,
              rateLimit,
            },
          );

          await this.dockerPipeline.checkHealth(runResult.containerId);

          latestDeployment.containerId = runResult.containerId;
          await this.deploymentRepository.save(latestDeployment);
        } catch (error) {
          throw new BadRequestException(
            `Error al recrear el contenedor en caliente: ${(error as Error).message}`,
          );
        }
      }
    }

    if (updateProjectDto.cpuLimit !== undefined) {
      project.cpuLimit = updateProjectDto.cpuLimit;
    }

    if (updateProjectDto.memoryLimit !== undefined) {
      project.memoryLimit = updateProjectDto.memoryLimit;
    }

    if (updateProjectDto.memorySwap !== undefined) {
      project.memorySwap = updateProjectDto.memorySwap;
    }

    return this.projectRepository.save(project);
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const project = await this.findOne(userId, id);
    await this.projectRepository.remove(project);
    return {
      message: `Proyecto "${project.name}" eliminado exitosamente`,
    };
  }

  async stopContainer(
    userId: string,
    id: string,
  ): Promise<ContainerActionResponse> {
    const project = await this.findOne(userId, id);
    const containerName = this.dockerPipeline.generateContainerName(
      project.repositoryName,
    );
    const status = await this.dockerPipeline.getContainerStatus(containerName);

    if (status === 'not_found') {
      throw new BadRequestException(
        `No se encontró ningún contenedor desplegado para el proyecto "${project.name}". Debe realizar al menos un despliegue primero.`,
      );
    }

    if (status === 'exited' || status === 'stopped') {
      return {
        projectId: project.id,
        containerName,
        action: 'stop',
        status: 'stopped',
        message: 'El contenedor ya se encontraba detenido.',
      };
    }

    await this.dockerPipeline.stopContainer(containerName);

    return {
      projectId: project.id,
      containerName,
      action: 'stop',
      status: 'stopped',
      message: 'Contenedor detenido exitosamente.',
    };
  }

  async startContainer(
    userId: string,
    id: string,
  ): Promise<ContainerActionResponse> {
    const project = await this.findOne(userId, id);
    const containerName = this.dockerPipeline.generateContainerName(
      project.repositoryName,
    );
    const status = await this.dockerPipeline.getContainerStatus(containerName);

    if (status === 'not_found') {
      throw new BadRequestException(
        `No se encontró ningún contenedor desplegado para el proyecto "${project.name}". Debe realizar al menos un despliegue primero.`,
      );
    }

    if (status === 'running') {
      return {
        projectId: project.id,
        containerName,
        action: 'start',
        status: 'running',
        message: 'El contenedor ya se encuentra en ejecución.',
      };
    }

    await this.dockerPipeline.startContainer(containerName);

    return {
      projectId: project.id,
      containerName,
      action: 'start',
      status: 'running',
      message: 'Contenedor iniciado exitosamente.',
    };
  }

  async restartContainer(
    userId: string,
    id: string,
  ): Promise<ContainerActionResponse> {
    const project = await this.findOne(userId, id);
    const containerName = this.dockerPipeline.generateContainerName(
      project.repositoryName,
    );
    const status = await this.dockerPipeline.getContainerStatus(containerName);

    if (status === 'not_found') {
      throw new BadRequestException(
        `No se encontró ningún contenedor desplegado para el proyecto "${project.name}". Debe realizar al menos un despliegue primero.`,
      );
    }

    await this.dockerPipeline.restartContainer(containerName);

    return {
      projectId: project.id,
      containerName,
      action: 'restart',
      status: 'running',
      message: 'Contenedor reiniciado exitosamente.',
    };
  }
}
