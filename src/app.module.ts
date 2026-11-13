import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AppLogger } from './common/logger/app-logger.service.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { DeploymentModule } from './deployment/deployment.module.js';
import { LogsModule } from './logs/logs.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { EncryptionModule } from './common/encryption/encryption.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { DeploymentsModule } from './deployments/deployments.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { TerminalModule } from './terminal/terminal.module.js';
import { DomainsModule } from './domains/domains.module.js';
import { DatabasesModule } from './databases/databases.module.js';
import { VolumesModule } from './volumes/volumes.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { SystemModule } from './system/system.module.js';
import { ClusterModule } from './cluster/cluster.module.js';
import { getTypeOrmConfig } from './database/database.config.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

const telemetryModules =
  process.env.NODE_ENV !== 'test'
    ? [
        ObserveModule.forRoot({
          appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
          appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
          serviceId: 'TitanPaaS',
        }),
      ]
    : [];

const databaseModules =
  process.env.NODE_ENV !== 'test'
    ? [
        TypeOrmModule.forRootAsync({
          useFactory: () => getTypeOrmConfig(),
        }),
        UsersModule,
        AuthModule,
        ProjectsModule,
        DeploymentsModule,
        NotificationsModule,
        TerminalModule,
        DomainsModule,
        DatabasesModule,
        VolumesModule,
        MaintenanceModule,
        TeamsModule,
      ]
    : [];

const workerModules =
  process.env.NODE_ENV !== 'test' || process.env.WORKER_ENABLED === 'true'
    ? [DeploymentModule]
    : [];

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => {
          if (process.env.NODE_ENV === 'test') {
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      },
    }),
    ...databaseModules,
    ...telemetryModules,
    ...workerModules,
    WebhooksModule,
    LogsModule,
    MetricsModule,
    EncryptionModule,
    SystemModule,
    ClusterModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppLogger,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [AppLogger],
})
export class AppModule {}
