import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import dns from 'node:dns/promises';
import { DnsService } from './dns.service.js';

describe('DnsService', () => {
  let service: DnsService;

  beforeEach(() => {
    service = new DnsService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveCname', () => {
    it('should return array of CNAME records', async () => {
      jest
        .spyOn(dns, 'resolveCname')
        .mockResolvedValue(['sample-project.localhost'] as never);

      const result = await service.resolveCname('app.example.com');
      expect(result).toEqual(['sample-project.localhost']);
    });

    it('should return empty array on DNS resolution error', async () => {
      jest
        .spyOn(dns, 'resolveCname')
        .mockRejectedValue(new Error('ENOTFOUND') as never);

      const result = await service.resolveCname('nonexistent.domain');
      expect(result).toEqual([]);
    });
  });

  describe('resolve4', () => {
    it('should return array of IPv4 addresses', async () => {
      jest.spyOn(dns, 'resolve4').mockResolvedValue(['192.168.1.50'] as never);

      const result = await service.resolve4('app.example.com');
      expect(result).toEqual(['192.168.1.50']);
    });

    it('should return empty array on DNS resolution error', async () => {
      jest
        .spyOn(dns, 'resolve4')
        .mockRejectedValue(new Error('ENODATA') as never);

      const result = await service.resolve4('no-a-record.domain');
      expect(result).toEqual([]);
    });
  });

  describe('verify', () => {
    it('should pass verification in test environment or local domains', async () => {
      const result = await service.verify(
        'myapp.local',
        'sample.localhost',
        '127.0.0.1',
      );
      expect(result.verified).toBe(true);
      expect(result.expectedCname).toBe('sample.localhost');
    });

    it('should pass verification when CNAME matches expected target', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        jest
          .spyOn(service, 'resolveCname')
          .mockResolvedValue(['sample.titanpaas.com.']);

        const result = await service.verify(
          'app.mycompany.com',
          'sample.titanpaas.com',
        );

        expect(result.verified).toBe(true);
        expect(result.detectedCnames).toEqual(['sample.titanpaas.com.']);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should pass verification when A record matches expected IP', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        jest.spyOn(service, 'resolveCname').mockResolvedValue([]);
        jest.spyOn(service, 'resolve4').mockResolvedValue(['203.0.113.10']);

        const result = await service.verify(
          'app.mycompany.com',
          'sample.titanpaas.com',
          '203.0.113.10',
        );

        expect(result.verified).toBe(true);
        expect(result.detectedIps).toEqual(['203.0.113.10']);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should fail verification when neither CNAME nor A record matches', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        jest.spyOn(service, 'resolveCname').mockResolvedValue(['other.domain']);
        jest.spyOn(service, 'resolve4').mockResolvedValue(['192.0.2.1']);

        const result = await service.verify(
          'app.mycompany.com',
          'sample.titanpaas.com',
          '203.0.113.10',
        );

        expect(result.verified).toBe(false);
        expect(result.error).toContain('Verificación fallida');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
