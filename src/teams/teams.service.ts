import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/team.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { TeamRole } from './enums/team-role.enum.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { AddTeamMemberDto } from './dto/add-team-member.dto.js';
import { UpdateTeamMemberRoleDto } from './dto/update-team-member-role.dto.js';

export interface SanitizedTeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TeamsService {
  constructor(
    @Optional()
    @InjectRepository(Team)
    private readonly teamRepository?: Repository<Team>,
    @Optional()
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository?: Repository<TeamMember>,
    @Optional()
    @InjectRepository(User)
    private readonly userRepository?: Repository<User>,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepository?: Repository<Project>,
  ) {}

  private generateSlug(name: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'team';
  }

  private sanitizeMember(member: TeamMember): SanitizedTeamMember {
    return {
      id: member.id,
      teamId: member.teamId,
      userId: member.userId,
      role: member.role,
      user: member.user
        ? {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
          }
        : undefined,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }

  async create(
    userId: string,
    dto: CreateTeamDto,
  ): Promise<Team & { myRole: TeamRole }> {
    const slug = dto.slug
      ? dto.slug.trim().toLowerCase()
      : this.generateSlug(dto.name);

    const existing = await this.teamRepository!.findOne({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException(`Ya existe un equipo con el slug "${slug}"`);
    }

    const team = this.teamRepository!.create({
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() || null,
      ownerId: userId,
    });

    const savedTeam = await this.teamRepository!.save(team);

    const ownerMembership = this.teamMemberRepository!.create({
      teamId: savedTeam.id,
      userId,
      role: TeamRole.OWNER,
    });
    await this.teamMemberRepository!.save(ownerMembership);

    return Object.assign(savedTeam, { myRole: TeamRole.OWNER });
  }

  async findAllForUser(
    userId: string,
  ): Promise<Array<Team & { myRole: TeamRole }>> {
    const memberships = await this.teamMemberRepository!.find({
      where: { userId },
      relations: ['team'],
      order: { createdAt: 'DESC' },
    });

    return memberships
      .filter((m) => Boolean(m.team))
      .map((m) => Object.assign(m.team, { myRole: m.role }));
  }

  async findOne(userId: string, teamId: string) {
    const membership = await this.assertTeamMembership(userId, teamId);

    const team = await this.teamRepository!.findOne({
      where: { id: teamId },
      relations: ['members', 'members.user'],
    });

    if (!team) {
      throw new NotFoundException(`Equipo #${teamId} no encontrado`);
    }

    return {
      ...team,
      myRole: membership.role,
      members: (team.members || []).map((m) => this.sanitizeMember(m)),
    };
  }

  async update(userId: string, teamId: string, dto: UpdateTeamDto) {
    await this.assertTeamMembership(userId, teamId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);

    const team = await this.teamRepository!.findOne({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(`Equipo #${teamId} no encontrado`);
    }

    if (dto.name !== undefined) {
      team.name = dto.name.trim();
    }

    if (dto.slug !== undefined) {
      const normalizedSlug = dto.slug.trim().toLowerCase();
      if (normalizedSlug !== team.slug) {
        const duplicate = await this.teamRepository!.findOne({
          where: { slug: normalizedSlug },
        });
        if (duplicate && duplicate.id !== teamId) {
          throw new ConflictException(
            `Ya existe un equipo con el slug "${normalizedSlug}"`,
          );
        }
        team.slug = normalizedSlug;
      }
    }

    if (dto.description !== undefined) {
      team.description = dto.description.trim() || null;
    }

    return this.teamRepository!.save(team);
  }

  async remove(userId: string, teamId: string): Promise<{ message: string }> {
    await this.assertTeamMembership(userId, teamId, [TeamRole.OWNER]);

    const team = await this.teamRepository!.findOne({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(`Equipo #${teamId} no encontrado`);
    }

    await this.teamRepository!.remove(team);
    return {
      message: `Equipo "${team.name}" eliminado exitosamente`,
    };
  }

  async getMembers(
    userId: string,
    teamId: string,
  ): Promise<SanitizedTeamMember[]> {
    await this.assertTeamMembership(userId, teamId);

    const members = await this.teamMemberRepository!.find({
      where: { teamId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return members.map((m) => this.sanitizeMember(m));
  }

  async addMember(
    userId: string,
    teamId: string,
    dto: AddTeamMemberDto,
  ): Promise<SanitizedTeamMember> {
    const callerMembership = await this.assertTeamMembership(userId, teamId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);

    if (
      callerMembership.role === TeamRole.ADMIN &&
      (dto.role === TeamRole.OWNER || dto.role === TeamRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Solo un Owner del equipo puede asignar roles de Owner o Admin',
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const targetUser = await this.userRepository!.findOne({
      where: { email: normalizedEmail },
    });

    if (!targetUser) {
      throw new NotFoundException(
        `No existe ningún usuario registrado con el correo "${normalizedEmail}"`,
      );
    }

    const existingMembership = await this.teamMemberRepository!.findOne({
      where: { teamId, userId: targetUser.id },
    });

    if (existingMembership) {
      throw new ConflictException(
        `El usuario "${normalizedEmail}" ya pertenece a este equipo`,
      );
    }

    const member = this.teamMemberRepository!.create({
      teamId,
      userId: targetUser.id,
      role: dto.role,
    });

    const saved = await this.teamMemberRepository!.save(member);
    saved.user = targetUser;
    return this.sanitizeMember(saved);
  }

  async updateMemberRole(
    userId: string,
    teamId: string,
    targetUserId: string,
    dto: UpdateTeamMemberRoleDto,
  ): Promise<SanitizedTeamMember> {
    const callerMembership = await this.assertTeamMembership(userId, teamId, [
      TeamRole.OWNER,
      TeamRole.ADMIN,
    ]);

    const targetMembership = await this.teamMemberRepository!.findOne({
      where: { teamId, userId: targetUserId },
      relations: ['user'],
    });

    if (!targetMembership) {
      throw new NotFoundException(
        `El usuario #${targetUserId} no es miembro del equipo #${teamId}`,
      );
    }

    if (callerMembership.role === TeamRole.ADMIN) {
      if (
        targetMembership.role === TeamRole.OWNER ||
        targetMembership.role === TeamRole.ADMIN
      ) {
        throw new ForbiddenException(
          'Un Admin no puede modificar el rol de un Owner ni de otro Admin',
        );
      }
      if (dto.role === TeamRole.OWNER || dto.role === TeamRole.ADMIN) {
        throw new ForbiddenException(
          'Solo un Owner puede promover miembros a Owner o Admin',
        );
      }
    }

    if (
      targetMembership.role === TeamRole.OWNER &&
      dto.role !== TeamRole.OWNER
    ) {
      const ownersCount = await this.teamMemberRepository!.count({
        where: { teamId, role: TeamRole.OWNER },
      });
      if (ownersCount <= 1) {
        throw new BadRequestException(
          'El equipo debe contar con al menos un Owner activo',
        );
      }
    }

    targetMembership.role = dto.role;
    const saved = await this.teamMemberRepository!.save(targetMembership);
    return this.sanitizeMember(saved);
  }

  async removeMember(
    userId: string,
    teamId: string,
    targetUserId: string,
  ): Promise<{ message: string }> {
    const callerMembership = await this.assertTeamMembership(userId, teamId);

    const isSelfLeave = userId === targetUserId;
    if (!isSelfLeave) {
      if (
        callerMembership.role !== TeamRole.OWNER &&
        callerMembership.role !== TeamRole.ADMIN
      ) {
        throw new ForbiddenException(
          'No tienes permisos suficientes para eliminar miembros del equipo',
        );
      }
    }

    const targetMembership = await this.teamMemberRepository!.findOne({
      where: { teamId, userId: targetUserId },
    });

    if (!targetMembership) {
      throw new NotFoundException(
        `El usuario #${targetUserId} no es miembro del equipo #${teamId}`,
      );
    }

    if (
      !isSelfLeave &&
      callerMembership.role === TeamRole.ADMIN &&
      (targetMembership.role === TeamRole.OWNER ||
        targetMembership.role === TeamRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Un Admin no puede eliminar a un Owner ni a otro Admin del equipo',
      );
    }

    if (targetMembership.role === TeamRole.OWNER) {
      const ownersCount = await this.teamMemberRepository!.count({
        where: { teamId, role: TeamRole.OWNER },
      });
      if (ownersCount <= 1) {
        throw new BadRequestException(
          'No puedes eliminar ni abandonar el equipo siendo el único Owner',
        );
      }
    }

    await this.teamMemberRepository!.remove(targetMembership);
    return {
      message: isSelfLeave
        ? 'Has abandonado el equipo exitosamente'
        : 'Miembro eliminado del equipo exitosamente',
    };
  }

  async getTeamProjects(userId: string, teamId: string): Promise<Project[]> {
    await this.assertTeamMembership(userId, teamId);

    return this.projectRepository!.find({
      where: { teamId },
      order: { createdAt: 'DESC' },
    });
  }

  async assertTeamMembership(
    userId: string,
    teamId: string,
    allowedRoles?: TeamRole[],
  ): Promise<TeamMember> {
    if (!this.teamRepository || !this.teamMemberRepository) {
      throw new NotFoundException(`Equipo #${teamId} no encontrado`);
    }

    const team = await this.teamRepository.findOne({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(`Equipo #${teamId} no encontrado`);
    }

    const membership = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('No perteneces a este equipo');
    }

    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'No tienes permisos suficientes en este equipo para realizar esta acción',
      );
    }

    return membership;
  }

  async assertProjectAccess(
    userId: string,
    project: Project | null,
    allowedTeamRoles?: TeamRole[],
    notFoundMessage?: string,
  ): Promise<TeamRole> {
    if (!project) {
      throw new NotFoundException(notFoundMessage || 'Proyecto no encontrado');
    }

    if (!project.teamId) {
      if (project.userId !== userId) {
        throw new NotFoundException(
          notFoundMessage || `Proyecto con ID "${project.id}" no encontrado`,
        );
      }
      return TeamRole.OWNER;
    }

    if (!this.teamMemberRepository) {
      if (project.userId !== userId) {
        throw new NotFoundException(
          notFoundMessage || `Proyecto con ID "${project.id}" no encontrado`,
        );
      }
      return TeamRole.OWNER;
    }

    const membership = await this.teamMemberRepository.findOne({
      where: { teamId: project.teamId, userId },
    });

    if (!membership) {
      throw new NotFoundException(
        notFoundMessage || `Proyecto con ID "${project.id}" no encontrado`,
      );
    }

    if (allowedTeamRoles && !allowedTeamRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'Tu rol en el equipo no tiene permisos para realizar esta acción sobre el proyecto',
      );
    }

    return membership.role;
  }

  async getAccessibleTeamIds(userId: string): Promise<string[]> {
    if (!this.teamMemberRepository) {
      return [];
    }

    const memberships = await this.teamMemberRepository.find({
      where: { userId },
    });

    return memberships.map((m) => m.teamId);
  }
}
