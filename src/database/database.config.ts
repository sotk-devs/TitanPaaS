import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { NotificationWebhook } from '../notifications/entities/notification-webhook.entity.js';
import { CustomDomain } from '../domains/entities/custom-domain.entity.js';
import { ProjectDatabase } from '../databases/entities/project-database.entity.js';
import { ProjectVolume } from '../volumes/entities/project-volume.entity.js';

export const getTypeOrmConfig = (): TypeOrmModuleOptions => {
  const isTest = process.env.NODE_ENV === 'test';

  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    autoLoadEntities: true,
    synchronize: false,
    entities: [
      User,
      Project,
      Deployment,
      NotificationWebhook,
      CustomDomain,
      ProjectDatabase,
      ProjectVolume,
    ],
    migrations: ['dist/database/migrations/*.js'],
    // Avoid hanging if database is unavailable
    retryAttempts: isTest ? 1 : 10,
    retryDelay: 2000,
  };

  if (process.env.DATABASE_URL) {
    return {
      ...baseConfig,
      url: process.env.DATABASE_URL,
    };
  }

  return {
    ...baseConfig,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'titan_paas',
  };
};
