import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deployment } from './entities/deployment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { DeploymentsService } from './deployments.service.js';
import { DeploymentsController } from './deployments.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Deployment, Project])],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
