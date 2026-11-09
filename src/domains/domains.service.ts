import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomDomain } from './entities/custom-domain.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { CreateCustomDomainDto } from './dto/create-custom-domain.dto.js';
import { DomainStatus } from './enums/domain-status.enum.js';
import { DnsService } from './dns.service.js';
import { DockerPipelineService } from '../deployment/docker-pipeline.service.js';

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    @InjectRepository(CustomDomain)
    private readonly domainRepository: Repository<CustomDomain>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly dnsService: DnsService,
    private readonly dockerPipeline: DockerPipelineService,
  ) {}

  private getDnsTargets(project: Project): {
    expectedCname: string;
    expectedIp?: string;
  } {
    const baseDomain = process.env.BASE_DOMAIN || 'localhost';
    const subdomain = project.name
      ? this.dockerPipeline.generateSubdomain(project.name)
      : this.dockerPipeline.generateSubdomain(project.repositoryName);

    const expectedCname = `${subdomain}.${baseDomain}`;
    const expectedIp = process.env.SERVER_IP || process.env.TRAEFIK_PUBLIC_IP;

    return { expectedCname, expectedIp };
  }

  async create(
    userId: string,
    projectId: string,
    dto: CreateCustomDomainDto,
  ): Promise<CustomDomain> {
    const domain = dto.domain.trim().toLowerCase();

    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto #${projectId} no encontrado o no pertenece al usuario autenticado.`,
      );
    }

    const existingDomain = await this.domainRepository.findOne({
      where: { domain },
    });

    if (existingDomain) {
      throw new ConflictException(
        `El dominio "${domain}" ya se encuentra registrado en la plataforma.`,
      );
    }

    const { expectedCname, expectedIp } = this.getDnsTargets(project);
    const verification = await this.dnsService.verify(
      domain,
      expectedCname,
      expectedIp,
    );

    const newDomain = this.domainRepository.create({
      domain,
      projectId: project.id,
      status: verification.verified
        ? DomainStatus.VERIFIED
        : DomainStatus.PENDING,
      verificationError: verification.verified
        ? null
        : verification.error || null,
      verifiedAt: verification.verified ? new Date() : null,
    });

    const saved = await this.domainRepository.save(newDomain);
    this.logger.log(
      `Dominio personalizado "${saved.domain}" registrado para proyecto "${project.name}" (Estado: ${saved.status}).`,
    );

    return saved;
  }

  async findAllByProject(
    userId: string,
    projectId: string,
  ): Promise<CustomDomain[]> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new NotFoundException(
        `Proyecto #${projectId} no encontrado o no pertenece al usuario autenticado.`,
      );
    }

    return this.domainRepository.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(userId: string, id: string): Promise<CustomDomain> {
    const customDomain = await this.domainRepository.findOne({
      where: { id },
      relations: ['project'],
    });

    if (!customDomain || customDomain.project?.userId !== userId) {
      throw new NotFoundException(
        `Dominio personalizado #${id} no encontrado o no pertenece al usuario autenticado.`,
      );
    }

    return customDomain;
  }

  async verify(userId: string, id: string): Promise<CustomDomain> {
    const customDomain = await this.findOne(userId, id);
    const project = customDomain.project;

    const { expectedCname, expectedIp } = this.getDnsTargets(project);
    const verification = await this.dnsService.verify(
      customDomain.domain,
      expectedCname,
      expectedIp,
    );

    if (verification.verified) {
      customDomain.status = DomainStatus.VERIFIED;
      customDomain.verificationError = null;
      customDomain.verifiedAt = new Date();
      this.logger.log(
        `Dominio "${customDomain.domain}" verificado exitosamente para el proyecto "${project.name}".`,
      );
    } else {
      customDomain.status = DomainStatus.FAILED;
      customDomain.verificationError =
        verification.error ||
        `No se pudo verificar el registro DNS para "${customDomain.domain}".`;
      this.logger.warn(
        `Fallo al verificar dominio "${customDomain.domain}": ${customDomain.verificationError}`,
      );
    }

    return this.domainRepository.save(customDomain);
  }

  async remove(userId: string, id: string): Promise<{ message: string }> {
    const customDomain = await this.findOne(userId, id);
    await this.domainRepository.remove(customDomain);

    return {
      message: `Dominio personalizado "${customDomain.domain}" eliminado exitosamente.`,
    };
  }
}
