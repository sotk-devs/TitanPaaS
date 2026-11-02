import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { Deployment } from '../deployments/entities/deployment.entity.js';

export const dataSourceOptions: DataSourceOptions = process.env.DATABASE_URL
  ? {
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, Project, Deployment],
      migrations: [
        'dist/database/migrations/*.js',
        'src/database/migrations/*.ts',
      ],
      synchronize: false,
    }
  : {
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT) || 5432,
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'titan_paas',
      entities: [User, Project, Deployment],
      migrations: [
        'dist/database/migrations/*.js',
        'src/database/migrations/*.ts',
      ],
      synchronize: false,
    };

export const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
