import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getDashboardHtml: jest
              .fn()
              .mockReturnValue(
                '<!DOCTYPE html><html><body>Dashboard Mock</body></html>',
              ),
          },
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboard', () => {
    it('should return html from DashboardService', () => {
      const result = controller.getDashboard();

      expect(result).toBe(
        '<!DOCTYPE html><html><body>Dashboard Mock</body></html>',
      );
      expect(service.getDashboardHtml).toHaveBeenCalledTimes(1);
    });
  });
});
