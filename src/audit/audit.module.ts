import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { TeamMember } from '../teams/entities/team-member.entity.js';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';

const databaseImports =
  process.env.NODE_ENV !== 'test'
    ? [TypeOrmModule.forFeature([AuditLog, Project, TeamMember])]
    : [];

@Module({
  imports: [...databaseImports],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
