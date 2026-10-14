import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { AppLogger } from './common/logger/app-logger.service.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';

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

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ...telemetryModules,
    UsersModule,
    AuthModule,
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
