import { describe, it, expect, beforeEach } from '@jest/globals';
import { EncryptionTransformer } from './encryption.transformer.js';
import { EncryptionService } from './encryption.service.js';

describe('EncryptionTransformer', () => {
  let transformer: EncryptionTransformer;
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
    transformer = new EncryptionTransformer(service);
  });

  it('should be defined', () => {
    expect(transformer).toBeDefined();
  });

  describe('to (database write)', () => {
    it('should encrypt plain object before writing to database', () => {
      const plainVars = { SECRET_TOKEN: 'super-secret', PORT: '8080' };
      const result = transformer.to(plainVars);

      expect(result.__encrypted).toBe(true);
      expect(result.iv).toBeDefined();
      expect(result.tag).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result).not.toEqual(plainVars);
    });

    it('should pass through already encrypted payload', () => {
      const encrypted = service.encryptJson({ KEY: 'VAL' });
      const result = transformer.to(encrypted);

      expect(result).toBe(encrypted);
    });

    it('should return empty object for null or undefined', () => {
      expect(transformer.to(null)).toEqual({});
      expect(transformer.to(undefined)).toEqual({});
    });
  });

  describe('from (database read)', () => {
    it('should decrypt encrypted database payload back to plain object', () => {
      const originalVars = { DB_PASSWORD: 'mypassword123', DEBUG: 'false' };
      const encrypted = transformer.to(originalVars);
      const decrypted = transformer.from(encrypted);

      expect(decrypted).toEqual(originalVars);
    });

    it('should pass through legacy unencrypted object', () => {
      const legacyVars = { LEGACY_VAR: 'plain-text-value' };
      const result = transformer.from(legacyVars);

      expect(result).toEqual(legacyVars);
    });

    it('should return empty object for falsy values', () => {
      expect(transformer.from(null)).toEqual({});
      expect(transformer.from(undefined)).toEqual({});
    });

    it('should return empty object if payload is corrupt', () => {
      const corruptPayload = {
        __encrypted: true,
        iv: 'invalid',
        tag: 'invalid',
        data: 'invalid',
      };
      const result = transformer.from(corruptPayload);
      expect(result).toEqual({});
    });
  });
});
