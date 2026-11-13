import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TeamRole } from '../enums/team-role.enum.js';

export class UpdateTeamMemberRoleDto {
  @ApiProperty({
    enum: TeamRole,
    example: TeamRole.ADMIN,
    description: 'Nuevo rol RBAC para el miembro del equipo',
  })
  @IsEnum(TeamRole, {
    message: 'El rol debe ser OWNER, ADMIN, DEVELOPER o VIEWER',
  })
  role: TeamRole;
}
