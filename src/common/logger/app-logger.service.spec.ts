import { describe, it, expect, beforeEach } from '@jest/globals';
import { AppLogger } from './app-logger.service.js';

describe('AppLogger', () => {
  let logger: AppLogger;

  beforeEach(() => {
    logger = new AppLogger();
  });

  it('should be defined and not throw on logging methods', () => {
    expect(logger).toBeDefined();
    expect(() => logger.log('Test info message')).not.toThrow();
    expect(() => logger.warn('Test warn message')).not.toThrow();
    expect(() =>
      logger.error('Test error message', 'stack trace'),
    ).not.toThrow();
    expect(() => logger.debug?.('Test debug message')).not.toThrow();
    expect(() => logger.verbose?.('Test verbose message')).not.toThrow();
  });
});
