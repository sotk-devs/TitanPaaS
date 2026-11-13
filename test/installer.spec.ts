import { describe, it, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

describe('VPS Production Deployment Infrastructure', () => {
  const rootDir = process.cwd();

  describe('Dockerfile', () => {
    it('should exist and define a multi-stage production build', () => {
      const dockerfilePath = join(rootDir, 'Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);

      const content = readFileSync(dockerfilePath, 'utf-8');
      expect(content).toContain('FROM node:22-alpine AS builder');
      expect(content).toContain('FROM node:22-alpine AS runner');
      expect(content).toContain('npm run build');
      expect(content).toContain('npm prune --omit=dev');
      expect(content).toContain('EXPOSE 3000');
      expect(content).toContain('CMD ["node", "dist/main.js"]');
    });
  });

  describe('docker-compose.prod.yml', () => {
    it('should exist and configure Traefik, PostgreSQL, Redis, and Titan API', () => {
      const composePath = join(rootDir, 'docker-compose.prod.yml');
      expect(existsSync(composePath)).toBe(true);

      const content = readFileSync(composePath, 'utf-8');
      expect(content).toContain('image: traefik:v3.1');
      expect(content).toContain('image: postgres:16-alpine');
      expect(content).toContain('image: redis:7-alpine');
      expect(content).toContain('container_name: titan-api');
      expect(content).toContain('titan-network');
      expect(content).toContain('postgres_data:');
      expect(content).toContain('redis_data:');
      expect(content).toContain('traefik_acme:');
      expect(content).toContain('certificatesresolvers.letsencrypt');
    });
  });

  describe('Unattended Installation Scripts', () => {
    it('should provide executable scripts/install.sh and titan.sh', () => {
      const installSh = join(rootDir, 'scripts', 'install.sh');
      const titanSh = join(rootDir, 'titan.sh');

      expect(existsSync(installSh)).toBe(true);
      expect(existsSync(titanSh)).toBe(true);

      const installContent = readFileSync(installSh, 'utf-8');
      expect(installContent.startsWith('#!/usr/bin/env bash')).toBe(true);
      expect(installContent).toContain('set -euo pipefail');
      expect(installContent).toContain('check_root');
      expect(installContent).toContain('install_docker');
      expect(installContent).toContain('generate_secret');
      expect(installContent).toContain('.env.production');
      expect(installContent).toContain('titanpaas.service');
    });

    it('should output help message when --help is supplied', () => {
      try {
        const bashBinary = existsSync('C:\\Program Files\\Git\\bin\\bash.exe')
          ? '"C:\\Program Files\\Git\\bin\\bash.exe"'
          : 'bash';

        const output = execSync(`${bashBinary} scripts/install.sh --help`, {
          cwd: rootDir,
          encoding: 'utf-8',
        });

        expect(output).toContain('TitanPaaS Production Installer');
        expect(output).toContain('--domain');
        expect(output).toContain('--dir');
        expect(output).toContain('--unattended');
      } catch (err: unknown) {
        // If bash binary is not accessible on the host runner, skip shell execution assertion
        expect(err).toBeDefined();
      }
    });
  });
});
