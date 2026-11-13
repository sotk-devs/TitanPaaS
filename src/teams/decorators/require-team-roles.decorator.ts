import { SetMetadata } from '@nestjs/common';
import { TeamRole } from '../enums/team-role.enum.js';

export const TEAM_ROLES_KEY = 'team_roles';

export const RequireTeamRoles = (...roles: TeamRole[]) =>
  SetMetadata(TEAM_ROLES_KEY, roles);
