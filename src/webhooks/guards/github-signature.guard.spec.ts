import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { GitHubSignatureGuard } from './github-signature.guard.js';
import { WebhooksService } from '../webhooks.service.js';

describe('GitHubSignatureGuard', () => {
  let guard: GitHubSignatureGuard;
  let service: jest.Mocked<Partial<WebhooksService>>;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    service = {
      verifySignature: jest.fn(),
    };
    guard = new GitHubSignatureGuard(service as WebhooksService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createMockExecutionContext(
    headers: Record<string, string | undefined> = {},
    body: Record<string, unknown> = {},
    rawBody?: Buffer,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          body,
          rawBody,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow request if GITHUB_WEBHOOK_SECRET is not configured', () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const context = createMockExecutionContext();

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw UnauthorizedException if signature header is missing when secret is configured', () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    const context = createMockExecutionContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if signature verification fails', () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    (service.verifySignature as jest.Mock).mockReturnValue(false);

    const context = createMockExecutionContext({
      'x-hub-signature-256': 'sha256=invalid',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should return true if signature verification succeeds', () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    (service.verifySignature as jest.Mock).mockReturnValue(true);

    const context = createMockExecutionContext(
      {
        'x-hub-signature-256': 'sha256=valid',
      },
      { ref: 'refs/heads/main' },
    );

    const result = guard.canActivate(context);
    expect(result).toBe(true);
    expect(service.verifySignature).toHaveBeenCalledWith(
      JSON.stringify({ ref: 'refs/heads/main' }),
      'sha256=valid',
      'test-secret',
    );
  });
});
