import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { AuditAction } from './enums/audit-action.enum.js';
import { AuditResourceType } from './enums/audit-resource-type.enum.js';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto.js';
import { Project } from '../projects/entities/project.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';

export interface CreateAuditLogInput {
  userId?: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  projectId?: string | null;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface PaginatedAuditLogsResult {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Optional()
    @InjectRepository(AuditLog)
    private readonly auditLogRepository?: Repository<AuditLog>,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepository?: Repository<Project>,
    @Optional()
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository?: Repository<TeamMember>,
  ) {}

  async record(input: CreateAuditLogInput): Promise<AuditLog | null> {
    if (!this.auditLogRepository) {
      return null;
    }

    try {
      const sanitizedDetails = this.sanitizeDetails(input.details || {});

      const auditLog = this.auditLogRepository.create({
        userId: input.userId || null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId || null,
        projectId: input.projectId || null,
        details: sanitizedDetails,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      });

      const saved = await this.auditLogRepository.save(auditLog);

      this.logger.log(
        `[Audit] Evento registrado: ${input.action} en ${input.resourceType}:${input.resourceId || input.projectId || 'N/A'} (Usuario: ${input.userId || 'SYSTEM'})`,
      );

      return saved;
    } catch (error) {
      this.logger.error(
        `Error al guardar registro de auditoria: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async findAll(
    userId: string,
    query: QueryAuditLogsDto,
  ): Promise<PaginatedAuditLogsResult> {
    if (!this.auditLogRepository) {
      return {
        items: [],
        total: 0,
        page: 1,
        limit: query.limit || 20,
        totalPages: 0,
      };
    }

    const accessibleProjectIds = await this.getAccessibleProjectIds(userId);

    if (query.projectId) {
      if (
        accessibleProjectIds.length === 0 ||
        !accessibleProjectIds.includes(query.projectId)
      ) {
        throw new ForbiddenException(
          `No tienes permisos para consultar los registros de auditoria del proyecto #${query.projectId}`,
        );
      }
    }

    const qb = this.auditLogRepository.createQueryBuilder('log');

    // Restringir a proyectos accesibles por el usuario o acciones realizadas por el usuario
    qb.where(
      '(log.userId = :userId OR (log.projectId IS NOT NULL AND log.projectId IN (:...accessibleProjectIds)))',
      {
        userId,
        accessibleProjectIds:
          accessibleProjectIds.length > 0
            ? accessibleProjectIds
            : ['00000000-0000-0000-0000-000000000000'],
      },
    );

    if (query.projectId) {
      qb.andWhere('log.projectId = :projectId', { projectId: query.projectId });
    }

    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }

    if (query.resourceType) {
      qb.andWhere('log.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }

    if (query.resourceId) {
      qb.andWhere('log.resourceId = :resourceId', {
        resourceId: query.resourceId,
      });
    }

    if (query.userId) {
      qb.andWhere('log.userId = :filterUserId', {
        filterUserId: query.userId,
      });
    }

    if (query.startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('log.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip(skip);
    qb.take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async findByProject(
    userId: string,
    projectId: string,
    query: QueryAuditLogsDto,
  ): Promise<PaginatedAuditLogsResult> {
    await this.verifyProjectAccess(userId, projectId);
    return this.findAll(userId, { ...query, projectId });
  }

  private async getAccessibleProjectIds(userId: string): Promise<string[]> {
    if (!this.projectRepository) {
      return [];
    }

    let userTeamIds: string[] = [];
    if (this.teamMemberRepository) {
      const memberships = await this.teamMemberRepository.find({
        where: { userId },
        select: ['teamId'],
      });
      userTeamIds = memberships.map((m) => m.teamId);
    }

    const qb = this.projectRepository.createQueryBuilder('project');
    qb.select('project.id');

    if (userTeamIds.length > 0) {
      qb.where(
        'project.userId = :userId OR project.teamId IN (:...userTeamIds)',
        {
          userId,
          userTeamIds,
        },
      );
    } else {
      qb.where('project.userId = :userId', { userId });
    }

    const projects = await qb.getMany();
    return projects.map((p) => p.id);
  }

  private async verifyProjectAccess(
    userId: string,
    projectId: string,
  ): Promise<void> {
    if (!this.projectRepository) {
      throw new NotFoundException(`Proyecto #${projectId} no encontrado`);
    }

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto #${projectId} no encontrado`);
    }

    if (project.userId === userId) {
      return;
    }

    if (project.teamId && this.teamMemberRepository) {
      const member = await this.teamMemberRepository.findOne({
        where: { teamId: project.teamId, userId },
      });
      if (member) {
        return;
      }
    }

    throw new ForbiddenException(
      `No tienes permisos para acceder al proyecto #${projectId}`,
    );
  }

  private sanitizeDetails(
    details: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      const lowerKey = key.toLowerCase();

      // Redactar contraseñas, tokens y llaves secretas
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('keyhash') ||
        lowerKey.includes('authorization')
      ) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Si es un mapa de variables de entorno, registrar sólo los nombres de las variables
      if (
        (lowerKey.includes('env') || lowerKey.includes('variables')) &&
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[key] = {
          variableCount: Object.keys(value).length,
          keys: Object.keys(value),
        };
        continue;
      }

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
