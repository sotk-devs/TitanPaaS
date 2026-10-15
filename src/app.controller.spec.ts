import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: '1' }),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getQueueToken('deployments'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('testQueue', () => {
    it('should enqueue a job', async () => {
      const response = await appController.testQueue();
      expect(response).toEqual({
        message: 'Job encolado exitosamente',
        jobId: '1',
      });
    });
  });
});
