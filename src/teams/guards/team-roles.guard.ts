import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember } from '../entities/team-member.entity.js';
import { TeamRole } from '../enums/team-role.enum.js';
import { TEAM_ROLES_KEY } from '../decorators/require-team-roles.decorator.js';

@Injectable()
export class TeamRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository?: Repository<TeamMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<TeamRole[]>(
      TEAM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id as string | undefined;
    const teamId = (request.params?.teamId ||
      request.params?.id ||
      request.body?.teamId ||
      request.query?.teamId) as string | undefined;

    if (!userId || !teamId || !this.teamMemberRepository) {
      throw new ForbiddenException(
        'No tienes permisos suficientes para acceder a este equipo',
      );
    }

    const membership = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'No tienes permisos suficientes en este equipo para realizar esta acción',
      );
    }

    request.teamMembership = membership;
    return true;
  }
}
