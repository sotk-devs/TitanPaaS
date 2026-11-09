import { describe, it, expect } from '@jest/globals';
import { CustomDomain } from './custom-domain.entity.js';
import { DomainStatus } from '../enums/domain-status.enum.js';

describe('CustomDomain Entity', () => {
  it('should create a valid CustomDomain instance with default values', () => {
    const domain = new CustomDomain();
    domain.id = 'uuid-domain-1';
    domain.domain = 'my-app.com';
    domain.projectId = 'uuid-project-1';
    domain.status = DomainStatus.PENDING;
    domain.verificationError = null;
    domain.verifiedAt = null;
    domain.createdAt = new Date();
    domain.updatedAt = new Date();

    expect(domain.id).toBe('uuid-domain-1');
    expect(domain.domain).toBe('my-app.com');
    expect(domain.status).toBe(DomainStatus.PENDING);
    expect(domain.verificationError).toBeNull();
  });
});
