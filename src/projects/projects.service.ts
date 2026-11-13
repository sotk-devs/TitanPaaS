import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Project } from './entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { DeploymentStatus } from '../deployments/enums/deployment-status.enum.js';
import { DomainStatus } from '../domains/enums/domain-status.enum.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ImportEnvDto, ImportEnvMode } from './dto/import-env.dto.js';
import { ImportEnvResponseDto } from './dto/import-env-response.dto.js';
import { ExportEnvResponseDto } from './dto/export-env-response.dto.js';
import { parseEnv, formatEnv } from './utils/env-parser.util.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { TeamRole } from '../teams/enums/team-role.enum.js';
import { AuditService } from '../audit/audit.service.js';
import { AuditAction } from '../audit/enums/audit-action.enum.js';
import { AuditResourceType } from '../audit/enums/audit-resource-type.enum.js';

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
    @Optional()
    private readonly teamsService?: TeamsService,
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  async create(
    userId: string,
    createProjectDto: CreateProjectDto,
  ): Promise<Project> {
    const normalizedName = createProjectDto.name.trim();

    if (createProjectDto.teamId && this.teamsService) {
      await this.teamsService.assertTeamMembership(
        userId,
        createProjectDto.teamId,
        [TeamRole.OWNER, TeamRole.ADMIN],
      );
    }

    const duplicateWhere = createProjectDto.teamId
      ? { name: normalizedName, teamId: createProjectDto.teamId }
      : { name: normalizedName, userId };

    const existingProject = await this.projectRepository.findOne({
      where: duplicateWhere,
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

    const savedProject = await this.projectRepository.save(project);

    await this.auditService?.record({
      userId,
      action: AuditAction.PROJECT_CREATE,
      resourceType: AuditResourceType.PROJECT,
      resourceId: savedProject.id,
      projectId: savedProject.id,
      details: {
        name: savedProject.name,
        repositoryName: savedProject.repositoryName,
        branch: savedProject.branch,
        port: savedProject.port,
        teamId: savedProject.teamId || null,
      },
    });

    return savedProject;
  }

  async findAll(userId: string): Promise<Project[]> {
    if (this.teamsService) {
      const teamIds = await this.teamsService.getAccessibleTeamIds(userId);
      if (teamIds.length > 0) {
        return this.projectRepository.find({
          where: [{ userId }, { teamId: In(teamIds) }],
          order: { createdAt: 'DESC' },
        });
      }
    }

    return this.projectRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  private async findOneWithAccess(
    userId: string,
    id: string,
    allowedTeamRoles?: TeamRole[],
  ): Promise<Project> {
    if (!this.teamsService) {
      const project = await this.projectRepository.findOne({
        where: { id, userId },
        relations: ['deployments', 'customDomains'],
      });

      if (!project) {
        throw new NotFoundException(`Proyecto con ID "${id}" no encontrado`);
      }

      return project;
    }

    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['deployments', 'customDomains'],
    });

    await this.teamsService.assertProjectAccess(
      userId,
      project,
      allowedTeamRoles,
      `Proyecto con ID "${id}" no encontrado`,
    );

    return project!;
  }

  async findOne(userId: string, id: string): Promise<Project> {
    return this.findOneWithAccess(userId, id);
  }

  async update(
    userId: string,
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findOneWithAccess(userId, id, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.DEVELOPER,
    ]);

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

    const savedProject = await this.projectRepository.save(project);

    await this.auditService?.record({
      userId,
      action: AuditAction.PROJECT_UPDATE,
      resourceType: AuditResourceType.PROJECT,
      resourceId: savedProject.id,
      projectId: savedProject.id,
      details: {
        updatedFields: Object.keys(updateProjectDto),
      },
    });

    if (envVariablesUpdated) {
      await this.auditService?.record({
        userId,
        action: AuditAction.ENV_UPDATE,
        resourceType: AuditResourceType.ENVIRONMENT,
        resourceId: savedProject.id,
        projectId: savedProject.id,
        details: {
          action: 'env_variables_updated',
          keys: Object.keys(updateProjectDto.envVariables || {}),
          count: Object.keys(updateProjectDto.envVariables || {}).length,
        },
      });
    }

    return savedProject;
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const project = await this.findOneWithAccess(userId, id, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);
    await this.projectRepository.remove(project);

    await this.auditService?.record({
      userId,
      action: AuditAction.PROJECT_DELETE,
      resourceType: AuditResourceType.PROJECT,
      resourceId: id,
      projectId: id,
      details: {
        name: project.name,
        repositoryName: project.repositoryName,
      },
    });

    return {
      message: `Proyecto "${project.name}" eliminado exitosamente`,
    };
  }

  async stopContainer(
    userId: string,
    id: string,
  ): Promise<ContainerActionResponse> {
    const project = await this.findOneWithAccess(userId, id, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.DEVELOPER,
    ]);
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
    const project = await this.findOneWithAccess(userId, id, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.DEVELOPER,
    ]);
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
    const project = await this.findOneWithAccess(userId, id, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.DEVELOPER,
    ]);
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

  async importEnv(
    userId: string,
    id: string,
    importEnvDto: ImportEnvDto,
  ): Promise<ImportEnvResponseDto> {
    const project = await this.findOneWithAccess(userId, id, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.DEVELOPER,
    ]);
    const parsed = parseEnv(importEnvDto.content);

    const mode = importEnvDto.mode || ImportEnvMode.MERGE;
    let finalEnv: Record<string, string>;

    if (mode === ImportEnvMode.REPLACE) {
      finalEnv = { ...parsed };
    } else {
      finalEnv = {
        ...project.envVariables,
        ...parsed,
      };
    }

    await this.update(userId, id, { envVariables: finalEnv });

    return {
      message: 'Variables de entorno importadas exitosamente',
      mode,
      importedCount: Object.keys(parsed).length,
      totalCount: Object.keys(finalEnv).length,
      variables: finalEnv,
    };
  }

  async exportEnv(userId: string, id: string): Promise<ExportEnvResponseDto> {
    const project = await this.findOne(userId, id);
    const variables = project.envVariables || {};
    const raw = formatEnv(variables);

    return {
      raw,
      variables,
      count: Object.keys(variables).length,
    };
  }
}
