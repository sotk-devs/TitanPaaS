import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsService } from './metrics.service.js';
import { MetricsGateway } from './metrics.gateway.js';
import { MetricsController } from './metrics.controller.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';

const databaseImports =
  process.env.NODE_ENV !== 'test'
    ? [TypeOrmModule.forFeature([Project, Deployment])]
    : [];

@Module({
  imports: [...databaseImports],
  controllers: [MetricsController],
  providers: [MetricsService, MetricsGateway],
  exports: [MetricsService, MetricsGateway],
})
export class MetricsModule {}
