import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';
import { NotificationWebhook } from '../notifications/entities/notification-webhook.entity.js';
import { CustomDomain } from '../domains/entities/custom-domain.entity.js';
import { ProjectVolume } from '../volumes/entities/project-volume.entity.js';

export const dataSourceOptions: DataSourceOptions = process.env.DATABASE_URL
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        User,
        Project,
        Deployment,
        NotificationWebhook,
        CustomDomain,
        ProjectVolume,
      ],
      migrations: ['src/database/migrations/*.ts'],
      synchronize: false,
    }
  : {
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'titan_paas',
      entities: [
        User,
        Project,
        Deployment,
        NotificationWebhook,
        CustomDomain,
        ProjectVolume,
      ],
      migrations: ['src/database/migrations/*.ts'],
      synchronize: false,
    };

const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
