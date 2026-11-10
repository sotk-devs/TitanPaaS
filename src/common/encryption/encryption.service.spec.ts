import { describe, it, expect, beforeEach } from '@jest/globals';
import { EncryptionService } from './encryption.service.js';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encryptText and decryptText', () => {
    it('should encrypt and decrypt a plaintext string with AES-256-GCM', () => {
      const secret = 'super-secret-database-password-1234';
      const encrypted = service.encryptText(secret);

      expect(encrypted.__encrypted).toBe(true);
      expect(encrypted.iv).toHaveLength(24); // 12 bytes in hex = 24 chars
      expect(encrypted.tag).toHaveLength(32); // 16 bytes in hex = 32 chars
      expect(encrypted.data).toBeDefined();
      expect(encrypted.data).not.toBe(secret);

      const decrypted = service.decryptText(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('should generate different IVs and ciphertexts for the same plaintext', () => {
      const secret = 'identical-secret';
      const enc1 = service.encryptText(secret);
      const enc2 = service.encryptText(secret);

      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.data).not.toBe(enc2.data);
      expect(service.decryptText(enc1)).toBe(secret);
      expect(service.decryptText(enc2)).toBe(secret);
    });

    it('should fail with authentication error if ciphertext is tampered with', () => {
      const encrypted = service.encryptText('valid-secret');
      const tampered = {
        ...encrypted,
        data:
          encrypted.data.slice(0, -2) +
          (encrypted.data.endsWith('0') ? '1' : '0'),
      };

      expect(() => service.decryptText(tampered)).toThrow();
    });

    it('should fail if auth tag is tampered with', () => {
      const encrypted = service.encryptText('valid-secret');
      const tampered = {
        ...encrypted,
        tag:
          encrypted.tag.slice(0, -1) +
          (encrypted.tag.endsWith('a') ? 'b' : 'a'),
      };

      expect(() => service.decryptText(tampered)).toThrow();
    });

    it('should throw an error if encrypted payload structure is invalid', () => {
      expect(() => service.decryptText({} as any)).toThrow(
        'Invalid encrypted payload structure',
      );
    });
  });

  describe('encryptJson and decryptJson', () => {
    it('should encrypt and decrypt JSON objects preserving types', () => {
      const envVars = {
        PORT: '3000',
        DATABASE_URL: 'postgres://user:pass@host:5432/db',
        API_KEY: 'sk_live_123456789',
        ENABLED: 'true',
      };

      const encrypted = service.encryptJson(envVars);
      expect(encrypted.__encrypted).toBe(true);
      expect(typeof encrypted.data).toBe('string');

      const decrypted = service.decryptJson<typeof envVars>(encrypted);
      expect(decrypted).toEqual(envVars);
    });

    it('should return unencrypted object directly if not marked as __encrypted', () => {
      const legacyVars = { OLD_KEY: 'plain_value' };
      const result = service.decryptJson(legacyVars);
      expect(result).toEqual(legacyVars);
    });

    it('should handle null and undefined safely in encryptJson', () => {
      const encNull = service.encryptJson(null);
      expect(service.decryptJson(encNull)).toEqual({});
    });
  });

  describe('deriveKey', () => {
    it('should derive a 32-byte key from any secret string', () => {
      const key1 = EncryptionService.deriveKey('my-short-pass');
      const key2 = EncryptionService.deriveKey('my-short-pass');
      const key3 = EncryptionService.deriveKey('another-pass');

      expect(key1).toHaveLength(32);
      expect(key1.equals(key2)).toBe(true);
      expect(key1.equals(key3)).toBe(false);
    });
  });
});
