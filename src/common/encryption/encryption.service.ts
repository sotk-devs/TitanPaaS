import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export interface EncryptedPayload {
  __encrypted: true;
  iv: string;
  tag: string;
  data: string;
}

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    this.key = EncryptionService.deriveKey();
  }

  static deriveKey(secret?: string): Buffer {
    const rawKey =
      secret ||
      process.env.ENCRYPTION_KEY ||
      process.env.TITAN_ENCRYPTION_KEY ||
      'titan-paas-default-encryption-key-32b-secure';

    return createHash('sha256').update(rawKey).digest();
  }

  encryptText(plainText: string): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);

    let encrypted = cipher.update(plainText, 'utf-8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag().toString('hex');

    return {
      __encrypted: true,
      iv: iv.toString('hex'),
      tag,
      data: encrypted,
    };
  }

  decryptText(payload: EncryptedPayload): string {
    if (!payload?.__encrypted || !payload.iv || !payload.tag || !payload.data) {
      throw new Error('Invalid encrypted payload structure');
    }

    const iv = Buffer.from(payload.iv, 'hex');
    const tag = Buffer.from(payload.tag, 'hex');

    if (tag.length !== 16) {
      throw new Error('Invalid authentication tag length');
    }

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv, {
      authTagLength: 16,
    });

    decipher.setAuthTag(tag);

    let decrypted = decipher.update(payload.data, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');

    return decrypted;
  }

  encryptJson(data: any): EncryptedPayload {
    const jsonString = JSON.stringify(data ?? {});
    return this.encryptText(jsonString);
  }

  decryptJson<T = any>(payload: any): T {
    if (payload && payload.__encrypted === true) {
      const jsonString = this.decryptText(payload as EncryptedPayload);
      return JSON.parse(jsonString) as T;
    }
    return payload as T;
  }
}
