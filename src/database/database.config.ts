import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity.js';

export const getTypeOrmConfig = (): TypeOrmModuleOptions => {
  const isTest = process.env.NODE_ENV === 'test';

  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    autoLoadEntities: true,
    synchronize: false,
    entities: [User],
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
