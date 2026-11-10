import { Module } from '@nestjs/common';
import { TerminalGateway } from './terminal.gateway.js';
import { TerminalService } from './terminal.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { DeploymentModule } from '../deployment/deployment.module.js';

@Module({
  imports: [AuthModule, ProjectsModule, DeploymentModule],
  providers: [TerminalGateway, TerminalService],
  exports: [TerminalGateway, TerminalService],
})
export class TerminalModule {}
