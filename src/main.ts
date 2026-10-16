import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from './app.module.js';
import { AppLogger } from './common/logger/app-logger.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    instrument: ObserveInstrument,
    rawBody: true,
  });

  const logger = app.get(AppLogger);
  app.useLogger(logger);

  // Security Middlewares
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`TitanPaaS application is running on port: ${port}`);
}
bootstrap();
