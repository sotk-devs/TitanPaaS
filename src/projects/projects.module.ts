import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { ProjectsService } from './projects.service.js';
import { ProjectsController } from './projects.controller.js';
import { DeploymentModule } from '../deployment/deployment.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Deployment]),
    DeploymentModule,
    TeamsModule,
    AuditModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService, TypeOrmModule],
})
export class ProjectsModule {}
