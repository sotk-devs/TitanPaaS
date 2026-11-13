export enum TeamRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  DEVELOPER = 'DEVELOPER',
  VIEWER = 'VIEWER',
}

export const TEAM_ROLE_LEVEL: Record<TeamRole, number> = {
  [TeamRole.OWNER]: 4,
  [TeamRole.ADMIN]: 3,
  [TeamRole.DEVELOPER]: 2,
  [TeamRole.VIEWER]: 1,
};
