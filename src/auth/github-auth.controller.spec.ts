import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { GithubAuthController } from './github-auth.controller.js';
import { GithubOAuthService } from './github-oauth.service.js';

describe('GithubAuthController', () => {
  let controller: GithubAuthController;
  let githubOAuthService: jest.Mocked<Partial<GithubOAuthService>>;

  const createMockResponse = () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    return res as unknown as Response;
  };

  beforeEach(() => {
    githubOAuthService = {
      getAuthorizationUrl: jest.fn().mockReturnValue({
        authorizationUrl: 'https://github.com/login/oauth/authorize?state=s1',
        state: 's1',
      }),
      verifyState: jest.fn().mockReturnValue({
        nonce: 'n1',
        iat: Date.now(),
        autoLink: true,
      }),
      authenticateWithCode: jest.fn().mockResolvedValue({
        access_token: 'jwt_token',
        user: {
          id: 'user-1',
          email: 'dev@titanpaas.dev',
          name: 'Dev',
          createdAt: new Date(),
        },
        github: {
          connected: true,
          username: 'dev',
          avatarUrl: null,
          isNewUser: false,
          autoLinkedCount: 1,
          linkedRepositories: [],
        },
      } as never),
      listUserRepositories: jest.fn().mockResolvedValue([] as never),
      linkRepositories: jest.fn().mockResolvedValue({
        linkedCount: 1,
        repositories: [],
      } as never),
      unlinkGithubAccount: jest.fn().mockResolvedValue({
        unlinked: true,
        message: 'Cuenta de GitHub desvinculada exitosamente',
      } as never),
    };

    controller = new GithubAuthController(
      githubOAuthService as unknown as GithubOAuthService,
    );
  });

  it('should redirect to GitHub authorization URL by default', () => {
    const res = createMockResponse();
    controller.authorize(res);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://github.com/login/oauth/authorize?state=s1',
    );
  });

  it('should return JSON authorization URL when format=json', () => {
    const res = createMockResponse();
    controller.authorize(res, 'json', 'true', 'http://localhost:5173');

    expect(githubOAuthService.getAuthorizationUrl).toHaveBeenCalledWith({
      autoLink: true,
      redirectUri: 'http://localhost:5173',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      authorizationUrl: 'https://github.com/login/oauth/authorize?state=s1',
      state: 's1',
    });
  });

  it('should return AuthResponse JSON from callback when no redirectUri is set', async () => {
    const res = createMockResponse();
    await controller.callback(res, 'code-123', 's1');

    expect(githubOAuthService.authenticateWithCode).toHaveBeenCalledWith(
      'code-123',
      's1',
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should throw BadRequestException if callback receives error or missing code', async () => {
    const res = createMockResponse();

    await expect(
      controller.callback(res, undefined, 's1', 'access_denied'),
    ).rejects.toThrow(BadRequestException);
    await expect(controller.callback(res, undefined, 's1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should exchange code via POST /auth/github/exchange', async () => {
    const result = await controller.exchangeCode({
      code: 'code-123',
      autoLink: true,
    });

    expect(githubOAuthService.authenticateWithCode).toHaveBeenCalledWith(
      'code-123',
      undefined,
      true,
    );
    expect(result.access_token).toBe('jwt_token');
  });

  it('should list, link repositories and unlink account for authenticated user', async () => {
    const req = { user: { id: 'user-1', email: 'a@b.com', name: 'A' } };

    await controller.listRepositories(req);
    expect(githubOAuthService.listUserRepositories).toHaveBeenCalledWith(
      'user-1',
    );

    await controller.linkRepositories(req, { all: true });
    expect(githubOAuthService.linkRepositories).toHaveBeenCalledWith('user-1', {
      all: true,
    });

    const unlinkRes = await controller.unlink(req);
    expect(githubOAuthService.unlinkGithubAccount).toHaveBeenCalledWith(
      'user-1',
    );
    expect(unlinkRes.unlinked).toBe(true);
  });
});
