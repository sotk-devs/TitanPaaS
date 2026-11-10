import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { ProjectDatabase } from './entities/project-database.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DatabasesDockerService } from './databases-docker.service.js';
import { CreateDatabaseDto } from './dto/create-database.dto.js';
import { DatabaseCredentialsDto } from './dto/database-credentials.dto.js';
import { DatabaseType } from './enums/database-type.enum.js';
import { DatabaseStatus } from './enums/database-status.enum.js';

@Injectable()
export class DatabasesService {
  private readonly logger = new Logger(DatabasesService.name);

  constructor(
    @InjectRepository(ProjectDatabase)
    private readonly databaseRepository: Repository<ProjectDatabase>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly databasesDocker: DatabasesDockerService,
  ) {}

  async verifyProjectOwnership(
    userId: string,
    projectId: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con ID ${projectId} no encontrado`);
    }

    if (project.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permisos para gestionar bases de datos en este proyecto',
      );
    }

    return project;
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateDatabaseDto,
  ): Promise<ProjectDatabase> {
    const project = await this.verifyProjectOwnership(userId, projectId);

    const existing = await this.databaseRepository.findOne({
      where: { projectId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una base de datos con el nombre "${dto.name}" en este proyecto`,
      );
    }

    const containerName = this.databasesDocker.generateContainerName(
      project.repositoryName,
      dto.name,
    );
    const volumeName = this.databasesDocker.generateVolumeName(
      project.repositoryName,
      dto.name,
    );
    const port = this.databasesDocker.getDefaultPort(dto.type);
    const version =
      dto.version ||
      (dto.type === DatabaseType.POSTGRESQL
        ? '16-alpine'
        : dto.type === DatabaseType.MYSQL
          ? '8.0'
          : '7-alpine');

    const password = dto.password || randomBytes(16).toString('hex');
    const databaseName =
      dto.type === DatabaseType.REDIS
        ? null
        : dto.databaseName ||
          `db_${project.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const username =
      dto.type === DatabaseType.REDIS
        ? null
        : dto.username ||
          (dto.type === DatabaseType.MYSQL ? 'root' : 'titan_user');

    const connectionUrl = this.databasesDocker.buildConnectionUrl(
      dto.type,
      containerName,
      port,
      username,
      password,
      databaseName,
    );

    const provisionResult = await this.databasesDocker.provisionContainer({
      type: dto.type,
      version,
      containerName,
      volumeName,
      port,
      databaseName,
      username,
      password,
    });

    const database = this.databaseRepository.create({
      name: dto.name,
      type: dto.type,
      version,
      status: DatabaseStatus.RUNNING,
      containerName,
      containerId: provisionResult.containerId,
      volumeName,
      port,
      databaseName,
      username,
      password,
      connectionUrl,
      projectId,
    });

    const savedDatabase = await this.databaseRepository.save(database);

    if (dto.autoInjectEnv) {
      const envKey =
        dto.type === DatabaseType.REDIS ? 'REDIS_URL' : 'DATABASE_URL';
      const updatedEnv = {
        ...project.envVariables,
        [envKey]: connectionUrl,
      };
      project.envVariables = updatedEnv;
      await this.projectRepository.save(project);
      this.logger.log(
        `Variable ${envKey} inyectada automaticamente en el proyecto ${project.id}`,
      );
    }

    return savedDatabase;
  }

  async findAllByProject(
    userId: string,
    projectId: string,
  ): Promise<ProjectDatabase[]> {
    await this.verifyProjectOwnership(userId, projectId);
    const databases = await this.databaseRepository.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });

    for (const db of databases) {
      try {
        const liveStatus = await this.databasesDocker.inspectStatus(
          db.containerName,
        );
        if (liveStatus !== db.status) {
          db.status = liveStatus;
          await this.databaseRepository.save(db);
        }
      } catch {
        // Ignorar fallas al consultar docker
      }
    }

    return databases;
  }

  async findOne(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<ProjectDatabase> {
    await this.verifyProjectOwnership(userId, projectId);
    const database = await this.databaseRepository.findOne({
      where: { id, projectId },
    });

    if (!database) {
      throw new NotFoundException(
        `Base de datos #${id} no encontrada en este proyecto`,
      );
    }

    try {
      const liveStatus = await this.databasesDocker.inspectStatus(
        database.containerName,
      );
      if (liveStatus !== database.status) {
        database.status = liveStatus;
        await this.databaseRepository.save(database);
      }
    } catch {
      // Ignorar fallas al consultar docker
    }

    return database;
  }

  async getCredentials(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<DatabaseCredentialsDto> {
    const database = await this.findOne(userId, projectId, id);

    return {
      host: database.containerName,
      port: database.port,
      databaseName: database.databaseName,
      username: database.username,
      password: database.password,
      connectionUrl: database.connectionUrl,
    };
  }

  async start(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<ProjectDatabase> {
    const database = await this.findOne(userId, projectId, id);
    await this.databasesDocker.startContainer(database.containerName);
    database.status = DatabaseStatus.RUNNING;
    return await this.databaseRepository.save(database);
  }

  async stop(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<ProjectDatabase> {
    const database = await this.findOne(userId, projectId, id);
    await this.databasesDocker.stopContainer(database.containerName);
    database.status = DatabaseStatus.STOPPED;
    return await this.databaseRepository.save(database);
  }

  async restart(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<ProjectDatabase> {
    const database = await this.findOne(userId, projectId, id);
    await this.databasesDocker.restartContainer(database.containerName);
    database.status = DatabaseStatus.RUNNING;
    return await this.databaseRepository.save(database);
  }

  async remove(
    userId: string,
    projectId: string,
    id: string,
    deleteVolume = true,
  ): Promise<{ message: string }> {
    const database = await this.findOne(userId, projectId, id);

    await this.databasesDocker.removeContainer(database.containerName);
    if (deleteVolume) {
      await this.databasesDocker.removeVolume(database.volumeName);
    }

    await this.databaseRepository.remove(database);

    return {
      message: `Base de datos "${database.name}" eliminada exitosamente`,
    };
  }
}
