import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TeamRole } from '../enums/team-role.enum.js';

export class AddTeamMemberDto {
  @ApiProperty({
    example: 'collaborator@titanpaas.dev',
    description:
      'Correo electrónico del usuario registrado a agregar al equipo',
  })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio' })
  email: string;

  @ApiProperty({
    enum: TeamRole,
    example: TeamRole.DEVELOPER,
    description: 'Rol RBAC asignado al miembro dentro del equipo',
  })
  @IsEnum(TeamRole, {
    message: 'El rol debe ser OWNER, ADMIN, DEVELOPER o VIEWER',
  })
  role: TeamRole;
}
