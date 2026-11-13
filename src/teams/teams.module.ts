import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './entities/team.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { TeamsService } from './teams.service.js';
import { TeamsController } from './teams.controller.js';
import { TeamRolesGuard } from './guards/team-roles.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamMember, User, Project])],
  controllers: [TeamsController],
  providers: [TeamsService, TeamRolesGuard],
  exports: [TeamsService, TeamRolesGuard, TypeOrmModule],
})
export class TeamsModule {}
