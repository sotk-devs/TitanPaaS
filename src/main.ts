try {
  process.loadEnvFile?.();
} catch {
  // Ignore if .env is missing
}

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from './app.module.js';
import { AppLogger } from './common/logger/app-logger.service.js';
import { setupSwagger } from './common/swagger/swagger.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    instrument: ObserveInstrument,
    rawBody: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  // Global Validation Pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Security Middlewares
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                  "'self'",
                  "'unsafe-inline'",
                  'https://cdn.socket.io',
                ],
                styleSrc: [
                  "'self'",
                  "'unsafe-inline'",
                  'https://fonts.googleapis.com',
                ],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
                imgSrc: ["'self'", 'data:', 'https:'],
              },
            }
          : false,
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Swagger Documentation & Interactive UI
  setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`TitanPaaS application is running on port: ${port}`);
  logger.log(
    `Swagger Interactive UI available at: http://localhost:${port}/docs`,
  );
  logger.log(
    `TitanPaaS Dashboard Web available at: http://localhost:${port}/dashboard`,
  );
}
bootstrap();
