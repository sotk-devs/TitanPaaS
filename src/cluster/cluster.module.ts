import { Module } from '@nestjs/common';
import { ClusterController } from './cluster.controller.js';
import { ClusterService } from './cluster.service.js';

@Module({
  controllers: [ClusterController],
  providers: [ClusterService],
  exports: [ClusterService],
})
export class ClusterModule {}
