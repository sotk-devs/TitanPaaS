import { Controller, Get } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectQueue('deployments') private readonly deploymentQueue: Queue,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-queue')
  async testQueue() {
    const job = await this.deploymentQueue.add('deploy-job', {
      repository: 'https://github.com/example/repo',
      timestamp: new Date().toISOString(),
    });

    return {
      message: 'Job encolado exitosamente',
      jobId: job.id,
    };
  }
}
