import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectDatabase } from './entities/project-database.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentModule } from '../deployment/deployment.module.js';
import { DatabasesService } from './databases.service.js';
import { DatabasesDockerService } from './databases-docker.service.js';
import { DatabasesController } from './databases.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectDatabase, Project]),
    DeploymentModule,
  ],
  controllers: [DatabasesController],
  providers: [DatabasesService, DatabasesDockerService],
  exports: [DatabasesService, DatabasesDockerService],
})
export class DatabasesModule {}
