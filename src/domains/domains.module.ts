import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomDomain } from './entities/custom-domain.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DomainsService } from './domains.service.js';
import { DomainsController } from './domains.controller.js';
import { DnsService } from './dns.service.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { DeploymentModule } from '../deployment/deployment.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomDomain, Project]),
    ProjectsModule,
    DeploymentModule,
  ],
  controllers: [DomainsController],
  providers: [DomainsService, DnsService],
  exports: [DomainsService, DnsService, TypeOrmModule],
})
export class DomainsModule {}
