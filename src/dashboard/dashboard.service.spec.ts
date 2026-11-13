import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardHtml', () => {
    it('should return valid HTML containing modern dashboard structure', () => {
      const html = service.getDashboardHtml();

      expect(typeof html).toBe('string');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('TitanPaaS');
      expect(html).toContain('Dashboard');
    });

    it('should include authentication components (login, register, token handling)', () => {
      const html = service.getDashboardHtml();

      expect(html).toContain('id="loginForm"');
      expect(html).toContain('id="registerForm"');
      expect(html).toContain('handleLogin');
      expect(html).toContain('handleRegister');
      expect(html).toContain('handleLogout');
      expect(html).toContain('titan_paas_token');
    });

    it('should include project management components (listing, creation modal, controls)', () => {
      const html = service.getDashboardHtml();

      expect(html).toContain('id="projectsContainer"');
      expect(html).toContain('openCreateProjectModal');
      expect(html).toContain('handleCreateProject');
      expect(html).toContain('controlProject');
      expect(html).toContain('triggerDeploy');
      expect(html).toContain('deleteProject');
    });

    it('should include real-time hardware metrics integration (WebSocket /metrics, CPU, RAM, Network)', () => {
      const html = service.getDashboardHtml();

      expect(html).toContain('socket.io');
      expect(html).toContain('/metrics');
      expect(html).toContain('joinProject');
      expect(html).toContain('metrics:update');
      expect(html).toContain('metricCpuVal');
      expect(html).toContain('metricMemVal');
      expect(html).toContain('metricNetVal');
      expect(html).toContain('metricCpuBar');
      expect(html).toContain('metricMemBar');
    });
  });
});
