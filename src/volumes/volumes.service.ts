import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectVolume } from './entities/project-volume.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';
import { CreateVolumeDto } from './dto/create-volume.dto.js';
import { UpdateVolumeDto } from './dto/update-volume.dto.js';

@Injectable()
export class VolumesService {
  private readonly logger = new Logger(VolumesService.name);

  constructor(
    @InjectRepository(ProjectVolume)
    private readonly volumeRepository: Repository<ProjectVolume>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly dockerPipeline: DockerPipelineService,
  ) {}

  generateDockerVolumeName(repositoryName: string, name: string): string {
    const cleanRepo = repositoryName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `titan_vol_${cleanRepo}_${cleanName}`;
  }

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
        'No tienes permisos para gestionar volumenes en este proyecto',
      );
    }

    return project;
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateVolumeDto,
  ): Promise<ProjectVolume> {
    const project = await this.verifyProjectOwnership(userId, projectId);

    const normalizedMountPath = dto.mountPath.trim().replace(/\/+$/, '');

    // Verificar unicidad de ruta de montaje en el proyecto
    const existingPath = await this.volumeRepository.findOne({
      where: {
        projectId,
        mountPath: normalizedMountPath,
      },
    });

    if (existingPath) {
      throw new ConflictException(
        `Ya existe un volumen asignado a la ruta de montaje ${normalizedMountPath}`,
      );
    }

    // Verificar unicidad de nombre en el proyecto
    const existingName = await this.volumeRepository.findOne({
      where: {
        projectId,
        name: dto.name,
      },
    });

    if (existingName) {
      throw new ConflictException(
        `Ya existe un volumen con el nombre "${dto.name}" en este proyecto`,
      );
    }

    const volumeName = this.generateDockerVolumeName(
      project.repositoryName,
      dto.name,
    );

    // Crear el volumen en Docker si no existe
    await this.dockerPipeline.createDockerVolume(volumeName);

    const volume = this.volumeRepository.create({
      name: dto.name,
      volumeName,
      mountPath: normalizedMountPath,
      readOnly: dto.readOnly ?? false,
      size: dto.size ?? null,
      projectId,
    });

    const saved = await this.volumeRepository.save(volume);
    this.logger.log(
      `[Volumes] Volumen ${saved.name} (${saved.volumeName}) creado para proyecto ${projectId} en ruta ${saved.mountPath}`,
    );

    return saved;
  }

  async findAllByProject(
    userId: string,
    projectId: string,
  ): Promise<ProjectVolume[]> {
    await this.verifyProjectOwnership(userId, projectId);

    return this.volumeRepository.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<ProjectVolume> {
    await this.verifyProjectOwnership(userId, projectId);

    const volume = await this.volumeRepository.findOne({
      where: { id, projectId },
    });

    if (!volume) {
      throw new NotFoundException(`Volumen con ID ${id} no encontrado`);
    }

    return volume;
  }

  async update(
    userId: string,
    projectId: string,
    id: string,
    dto: UpdateVolumeDto,
  ): Promise<ProjectVolume> {
    const volume = await this.findOne(userId, projectId, id);

    if (dto.readOnly !== undefined) {
      volume.readOnly = dto.readOnly;
    }
    if (dto.size !== undefined) {
      volume.size = dto.size;
    }

    return this.volumeRepository.save(volume);
  }

  async remove(
    userId: string,
    projectId: string,
    id: string,
  ): Promise<{ message: string }> {
    const volume = await this.findOne(userId, projectId, id);

    // Remover volumen fisico en Docker
    await this.dockerPipeline.removeDockerVolume(volume.volumeName);

    await this.volumeRepository.delete(id);

    this.logger.log(
      `[Volumes] Volumen ${volume.name} (${volume.volumeName}) eliminado de proyecto ${projectId}`,
    );

    return {
      message: `Volumen "${volume.name}" eliminado exitosamente`,
    };
  }
}
