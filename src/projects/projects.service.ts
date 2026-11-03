import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
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
      relations: ['deployments'],
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

    if (updateProjectDto.envVariables !== undefined) {
      project.envVariables = updateProjectDto.envVariables;
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
}
