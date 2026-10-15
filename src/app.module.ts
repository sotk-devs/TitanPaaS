import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DeploymentWorker } from './deployment.worker';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'TitanPaaS',
    }),
    // Conexión principal con Redis
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    // Cola para gestionar los despliegues del sistema
    BullModule.registerQueue({
      name: 'deployments',
    }),
  ],
  controllers: [AppController],
  providers: [AppService, DeploymentWorker],
})
export class AppModule {}
