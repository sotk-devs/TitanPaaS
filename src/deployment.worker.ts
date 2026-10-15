import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('deployments')
export class DeploymentWorker extends WorkerHost {
  private readonly logger = new Logger(DeploymentWorker.name);

  async process(job: Job<unknown, unknown, string>): Promise<unknown> {
    this.logger.log(`Procesando tarea de despliegue ID: ${job.id}`);
    this.logger.log(`Payload recibido: ${JSON.stringify(job.data)}`);
    return { status: 'completed' };
  }
}
