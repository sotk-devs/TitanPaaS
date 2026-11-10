import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectVolume } from './entities/project-volume.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { VolumesService } from './volumes.service.js';
import { VolumesController } from './volumes.controller.js';
import { DeploymentModule } from '../deployment/deployment.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectVolume, Project]),
    AuthModule,
    DeploymentModule,
  ],
  controllers: [VolumesController],
  providers: [VolumesService],
  exports: [VolumesService],
})
export class VolumesModule {}
