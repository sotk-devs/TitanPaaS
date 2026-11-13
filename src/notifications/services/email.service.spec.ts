import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  EmailService,
  DeploymentFailureAlertOptions,
} from './email.service.js';
import type { Transporter } from 'nodemailer';

describe('EmailService', () => {
  let mockTransporter: {
    sendMail: jest.MockedFunction<any>;
    verify: jest.MockedFunction<any>;
  };

  const defaultAlertOptions: DeploymentFailureAlertOptions = {
    to: 'owner@example.com',
    userName: 'Jane Dev',
    projectId: 'proj-123',
    projectName: 'api-service',
    repositoryName: 'acme/api-service',
    deploymentId: 'dep-456',
    branch: 'main',
    commitSha: 'a1b2c3d4e5f6',
    commitMessage: 'fix: database connection pool',
    author: 'janedev',
    durationMs: 45200,
    errorMessage:
      'Command failed with exit code 1: npm run build: TS2304 Cannot find name',
    timestamp: '2026-11-12T18:00:00.000Z',
  };

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({
        messageId: '<alert-12345@titanpaas.io>',
      } as never),
      verify: jest.fn().mockResolvedValue(true as never),
    };
  });

  describe('isEnabled', () => {
    it('should return false if enabled is false', () => {
      const service = new EmailService(
        { enabled: false, host: 'smtp.example.com' },
        mockTransporter as unknown as Transporter,
      );
      expect(service.isEnabled()).toBe(false);
    });

    it('should return false if enabled is true but host is empty', () => {
      const service = new EmailService(
        { enabled: true, host: '' },
        mockTransporter as unknown as Transporter,
      );
      expect(service.isEnabled()).toBe(false);
    });

    it('should return true if enabled is true and host is provided', () => {
      const service = new EmailService(
        { enabled: true, host: 'smtp.example.com' },
        mockTransporter as unknown as Transporter,
      );
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('sendDeploymentFailureAlert', () => {
    it('should skip sending if service is disabled', async () => {
      const service = new EmailService(
        { enabled: false, host: 'smtp.example.com' },
        mockTransporter as unknown as Transporter,
      );

      const result =
        await service.sendDeploymentFailureAlert(defaultAlertOptions);

      expect(result).toEqual({ success: true, skipped: true });
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should send email alert when service is enabled and return messageId', async () => {
      const service = new EmailService(
        {
          enabled: true,
          host: 'smtp.example.com',
          port: 587,
          from: 'TitanPaaS <alerts@titanpaas.io>',
          appUrl: 'https://dashboard.titanpaas.io',
        },
        mockTransporter as unknown as Transporter,
      );

      const result =
        await service.sendDeploymentFailureAlert(defaultAlertOptions);

      expect(result).toEqual({
        success: true,
        messageId: '<alert-12345@titanpaas.io>',
      });
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const sentPayload = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentPayload.to).toBe('owner@example.com');
      expect(sentPayload.from).toBe('TitanPaaS <alerts@titanpaas.io>');
      expect(sentPayload.subject).toContain(
        'Fallo en despliegue: api-service (main)',
      );

      // Plain text verification
      expect(sentPayload.text).toContain('Hola Jane Dev,');
      expect(sentPayload.text).toContain('api-service');
      expect(sentPayload.text).toContain('acme/api-service');
      expect(sentPayload.text).toContain('main');
      expect(sentPayload.text).toContain('a1b2c3d');
      expect(sentPayload.text).toContain('fix: database connection pool');
      expect(sentPayload.text).toContain('janedev');
      expect(sentPayload.text).toContain('45.20s');
      expect(sentPayload.text).toContain('Command failed with exit code 1');
      expect(sentPayload.text).toContain(
        'https://dashboard.titanpaas.io/projects/proj-123/deployments/dep-456',
      );

      // HTML verification
      expect(sentPayload.html).toContain('Fallo de Despliegue');
      expect(sentPayload.html).toContain('api-service');
      expect(sentPayload.html).toContain('acme/api-service');
      expect(sentPayload.html).toContain('Command failed with exit code 1');
      expect(sentPayload.html).toContain(
        'https://dashboard.titanpaas.io/projects/proj-123/deployments/dep-456',
      );

      // Verify NO emojis anywhere in the payload
      const fullContent = `${sentPayload.subject} ${sentPayload.text} ${sentPayload.html}`;
      const emojiRegex =
        /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      expect(emojiRegex.test(fullContent)).toBe(false);
    });

    it('should fallback to generic greeting if userName is not provided', async () => {
      const service = new EmailService(
        { enabled: true, host: 'smtp.example.com' },
        mockTransporter as unknown as Transporter,
      );

      const optionsWithoutUser: DeploymentFailureAlertOptions = {
        ...defaultAlertOptions,
        userName: undefined,
      };

      await service.sendDeploymentFailureAlert(optionsWithoutUser);

      const sentPayload = mockTransporter.sendMail.mock.calls[0][0];
      expect(sentPayload.text).toContain('Estimado desarrollador,');
      expect(sentPayload.html).toContain('Estimado desarrollador,');
    });

    it('should handle sendMail rejection gracefully without throwing', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(
        new Error('SMTP Connection timeout') as never,
      );

      const service = new EmailService(
        { enabled: true, host: 'smtp.example.com' },
        mockTransporter as unknown as Transporter,
      );

      const result =
        await service.sendDeploymentFailureAlert(defaultAlertOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP Connection timeout');
    });
  });
});
