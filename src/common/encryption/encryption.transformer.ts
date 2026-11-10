import type { ValueTransformer } from 'typeorm';
import {
  EncryptionService,
  type EncryptedPayload,
} from './encryption.service.js';

export class EncryptionTransformer implements ValueTransformer {
  private readonly encryptionService: EncryptionService;

  constructor(encryptionService?: EncryptionService) {
    this.encryptionService = encryptionService || new EncryptionService();
  }

  to(value: Record<string, string> | any): EncryptedPayload | any {
    if (value === null || value === undefined) {
      return {};
    }
    if (value.__encrypted === true) {
      return value;
    }
    return this.encryptionService.encryptJson(value);
  }

  from(value: any): Record<string, string> {
    if (!value) {
      return {};
    }
    try {
      if (value.__encrypted === true) {
        return this.encryptionService.decryptJson<Record<string, string>>(
          value,
        );
      }
      return value;
    } catch {
      return {};
    }
  }
}
