import {
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { API_SCOPES_KEY } from '../../api-keys/decorators/require-api-scopes.decorator.js';
import {
  API_KEY_PREFIX,
  ApiKeysService,
} from '../../api-keys/api-keys.service.js';
import { ApiKeyScope } from '../../api-keys/enums/api-key-scope.enum.js';

interface GuardRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  url?: string;
  path?: string;
  ip?: string;
  params?: Record<string, string>;
  user?: unknown;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Optional() private readonly apiKeysService?: ApiKeysService,
    @Optional() private readonly reflector?: Reflector,
  ) {
    super();
  }

  private extractApiKey(req: GuardRequest): string | null {
    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) {
      return headerKey.trim();
    }

    const authHeader = req.headers['authorization'];
    if (typeof authHeader !== 'string') {
      return null;
    }

    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith('apikey ')) {
      return trimmed.slice(7).trim();
    }

    if (trimmed.toLowerCase().startsWith('bearer ')) {
      const token = trimmed.slice(7).trim();
      if (token.startsWith(API_KEY_PREFIX)) {
        return token;
      }
    }

    return null;
  }

  private extractProjectId(
    req: GuardRequest,
    routePath: string,
  ): string | undefined {
    if (req.params?.projectId) {
      return req.params.projectId;
    }
    if (req.params?.id && /^\/projects\/[^/]+(?:\/|$)/i.test(routePath)) {
      return req.params.id;
    }
    return undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<GuardRequest>();
    const rawApiKey = this.extractApiKey(req);

    if (!rawApiKey) {
      return (await super.canActivate(context)) as boolean;
    }

    if (!this.apiKeysService) {
      throw new UnauthorizedException(
        'Autenticación por API Key no disponible',
      );
    }

    const routePath = req.path || req.originalUrl || req.url || '/';
    const explicitScopes = this.reflector?.getAllAndOverride<ApiKeyScope[]>(
      API_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredScopes =
      explicitScopes && explicitScopes.length > 0
        ? explicitScopes
        : ApiKeysService.inferRequiredScopes(req.method || 'GET', routePath);

    const projectId = this.extractProjectId(req, routePath);
    const authenticatedUser = await this.apiKeysService.authenticateRawKey(
      rawApiKey,
      requiredScopes,
      projectId,
      req.ip,
    );

    req.user = authenticatedUser;
    return true;
  }
}
