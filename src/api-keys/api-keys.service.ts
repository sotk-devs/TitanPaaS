import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { UpdateApiKeyDto } from './dto/update-api-key.dto.js';
import { ApiKey } from './entities/api-key.entity.js';
import {
  API_KEY_SCOPE_DESCRIPTIONS,
  ApiKeyScope,
} from './enums/api-key-scope.enum.js';

export const API_KEY_PREFIX = 'tp_live_';

export interface SafeApiKeyResponse {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  allowedProjectIds: string[] | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  revokedAt: Date | null;
  isActive: boolean;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatedApiKeyResponse extends SafeApiKeyResponse {
  token: string;
  warning: string;
}

export interface AuthenticatedApiKeyUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  apiKey: {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: ApiKeyScope[];
    allowedProjectIds: string[] | null;
  };
}

interface RouteScopeRule {
  pattern: RegExp;
  read: ApiKeyScope;
  write: ApiKeyScope;
}

const ROUTE_SCOPE_RULES: RouteScopeRule[] = [
  {
    pattern: /^\/projects\/[^/]+\/env(?:\/|$)/i,
    read: ApiKeyScope.ENV_READ,
    write: ApiKeyScope.ENV_WRITE,
  },
  {
    pattern:
      /^\/(?:projects\/[^/]+\/(?:deployments|deploy)|deployments)(?:\/|$)/i,
    read: ApiKeyScope.DEPLOYMENTS_READ,
    write: ApiKeyScope.DEPLOYMENTS_WRITE,
  },
  {
    pattern: /^\/projects\/[^/]+\/databases(?:\/|$)/i,
    read: ApiKeyScope.DATABASES_READ,
    write: ApiKeyScope.DATABASES_WRITE,
  },
  {
    pattern: /^\/projects\/[^/]+\/volumes(?:\/|$)/i,
    read: ApiKeyScope.VOLUMES_READ,
    write: ApiKeyScope.VOLUMES_WRITE,
  },
  {
    pattern: /^\/projects\/[^/]+\/domains(?:\/|$)/i,
    read: ApiKeyScope.DOMAINS_READ,
    write: ApiKeyScope.DOMAINS_WRITE,
  },
  {
    pattern: /^\/projects\/[^/]+\/notifications(?:\/|$)/i,
    read: ApiKeyScope.NOTIFICATIONS_READ,
    write: ApiKeyScope.NOTIFICATIONS_WRITE,
  },
  {
    pattern: /^\/projects(?:\/|$)/i,
    read: ApiKeyScope.PROJECTS_READ,
    write: ApiKeyScope.PROJECTS_WRITE,
  },
  {
    pattern: /^\/maintenance(?:\/|$)/i,
    read: ApiKeyScope.MAINTENANCE_READ,
    write: ApiKeyScope.MAINTENANCE_WRITE,
  },
  {
    pattern: /^\/metrics(?:\/|$)/i,
    read: ApiKeyScope.METRICS_READ,
    write: ApiKeyScope.METRICS_READ,
  },
  {
    pattern: /^\/api-keys(?:\/|$)/i,
    read: ApiKeyScope.API_KEYS_MANAGE,
    write: ApiKeyScope.API_KEYS_MANAGE,
  },
];

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly usersService: UsersService,
  ) {}

  static hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  static generateRawKey(): {
    rawKey: string;
    keyPrefix: string;
    keyHash: string;
  } {
    const secret = randomBytes(32).toString('hex');
    const rawKey = `${API_KEY_PREFIX}${secret}`;
    const keyPrefix = rawKey.slice(0, 16);
    const keyHash = ApiKeysService.hashKey(rawKey);
    return { rawKey, keyPrefix, keyHash };
  }

  static inferRequiredScopes(method: string, path: string): ApiKeyScope[] {
    const normalizedPath = path.split('?')[0];
    const isRead =
      method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';

    for (const rule of ROUTE_SCOPE_RULES) {
      if (rule.pattern.test(normalizedPath)) {
        return [isRead ? rule.read : rule.write];
      }
    }

    return [];
  }

  private resolveExpirationDate(
    expiresAt?: string,
    expiresInDays?: number,
  ): Date | null {
    if (expiresAt) {
      const parsed = new Date(expiresAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        throw new BadRequestException(
          'La fecha de expiración debe ser una fecha futura válida',
        );
      }
      return parsed;
    }

    if (expiresInDays !== undefined) {
      return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    return null;
  }

  private toSafeResponse(apiKey: ApiKey): SafeApiKeyResponse {
    const now = Date.now();
    const isExpired = Boolean(
      apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= now,
    );
    const isActive = !apiKey.revokedAt && !isExpired;

    return {
      id: apiKey.id,
      name: apiKey.name,
      description: apiKey.description ?? null,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      allowedProjectIds: apiKey.allowedProjectIds ?? null,
      expiresAt: apiKey.expiresAt ?? null,
      lastUsedAt: apiKey.lastUsedAt ?? null,
      lastUsedIp: apiKey.lastUsedIp ?? null,
      revokedAt: apiKey.revokedAt ?? null,
      isActive,
      isExpired,
      createdAt: apiKey.createdAt,
      updatedAt: apiKey.updatedAt,
    };
  }

  listAvailableScopes(): Array<{ scope: ApiKeyScope; description: string }> {
    return Object.values(ApiKeyScope).map((scope) => ({
      scope,
      description: API_KEY_SCOPE_DESCRIPTIONS[scope],
    }));
  }

  async create(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<CreatedApiKeyResponse> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const expiresAt = this.resolveExpirationDate(
      dto.expiresAt,
      dto.expiresInDays,
    );
    const uniqueScopes = Array.from(new Set(dto.scopes));
    const uniqueProjectIds = dto.allowedProjectIds
      ? Array.from(new Set(dto.allowedProjectIds))
      : null;

    const { rawKey, keyPrefix, keyHash } = ApiKeysService.generateRawKey();

    const apiKey = this.apiKeyRepository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      keyPrefix,
      keyHash,
      scopes: uniqueScopes,
      allowedProjectIds:
        uniqueProjectIds && uniqueProjectIds.length > 0
          ? uniqueProjectIds
          : null,
      expiresAt,
      userId,
    });

    const saved = await this.apiKeyRepository.save(apiKey);

    return {
      ...this.toSafeResponse(saved),
      token: rawKey,
      warning:
        'Guarda este token de forma segura; por seguridad no podrás volver a consultarlo.',
    };
  }

  async findAllByUser(
    userId: string,
    includeRevoked = false,
  ): Promise<SafeApiKeyResponse[]> {
    const keys = await this.apiKeyRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const filtered = includeRevoked
      ? keys
      : keys.filter((item) => !item.revokedAt);

    return filtered.map((item) => this.toSafeResponse(item));
  }

  private async findOwnedKey(userId: string, id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, userId },
    });

    if (!apiKey) {
      throw new NotFoundException(`API Key con ID "${id}" no encontrada`);
    }

    return apiKey;
  }

  async findOneByUser(userId: string, id: string): Promise<SafeApiKeyResponse> {
    const apiKey = await this.findOwnedKey(userId, id);
    return this.toSafeResponse(apiKey);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateApiKeyDto,
  ): Promise<SafeApiKeyResponse> {
    const apiKey = await this.findOwnedKey(userId, id);

    if (apiKey.revokedAt) {
      throw new BadRequestException(
        'No se puede modificar una API Key revocada',
      );
    }

    if (dto.name !== undefined) {
      apiKey.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      apiKey.description = dto.description.trim() || null;
    }
    if (dto.scopes !== undefined) {
      apiKey.scopes = Array.from(new Set(dto.scopes));
    }
    if (dto.allowedProjectIds !== undefined) {
      const uniqueIds = Array.from(new Set(dto.allowedProjectIds));
      apiKey.allowedProjectIds = uniqueIds.length > 0 ? uniqueIds : null;
    }
    if (dto.expiresAt !== undefined || dto.expiresInDays !== undefined) {
      apiKey.expiresAt = this.resolveExpirationDate(
        dto.expiresAt,
        dto.expiresInDays,
      );
    }

    const updated = await this.apiKeyRepository.save(apiKey);
    return this.toSafeResponse(updated);
  }

  async rotate(userId: string, id: string): Promise<CreatedApiKeyResponse> {
    const apiKey = await this.findOwnedKey(userId, id);

    if (apiKey.revokedAt) {
      throw new BadRequestException('No se puede rotar una API Key revocada');
    }

    const { rawKey, keyPrefix, keyHash } = ApiKeysService.generateRawKey();
    apiKey.keyPrefix = keyPrefix;
    apiKey.keyHash = keyHash;

    const saved = await this.apiKeyRepository.save(apiKey);

    return {
      ...this.toSafeResponse(saved),
      token: rawKey,
      warning:
        'La clave anterior quedó invalidada de inmediato. Guarda este nuevo token de forma segura.',
    };
  }

  async revoke(
    userId: string,
    id: string,
    permanent = false,
  ): Promise<{ revoked: true; id: string; permanent: boolean }> {
    const apiKey = await this.findOwnedKey(userId, id);

    if (permanent) {
      await this.apiKeyRepository.remove(apiKey);
      return { revoked: true, id, permanent: true };
    }

    if (!apiKey.revokedAt) {
      apiKey.revokedAt = new Date();
      await this.apiKeyRepository.save(apiKey);
    }

    return { revoked: true, id, permanent: false };
  }

  async authenticateRawKey(
    rawKey: string,
    requiredScopes: ApiKeyScope[] = [],
    projectId?: string,
    clientIp?: string,
  ): Promise<AuthenticatedApiKeyUser> {
    if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
      throw new UnauthorizedException('Formato de API Key inválido');
    }

    const keyHash = ApiKeysService.hashKey(rawKey);
    const apiKey = await this.apiKeyRepository.findOne({
      where: { keyHash },
    });

    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('API Key inválida o revocada');
    }

    if (
      apiKey.expiresAt &&
      new Date(apiKey.expiresAt).getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('La API Key ha expirado');
    }

    const hasFullAccess = apiKey.scopes.includes(ApiKeyScope.FULL_ACCESS);
    if (!hasFullAccess && requiredScopes.length > 0) {
      const missing = requiredScopes.filter(
        (scope) => !apiKey.scopes.includes(scope),
      );
      if (missing.length > 0) {
        throw new ForbiddenException(
          `La API Key no tiene los permisos requeridos (${missing.join(', ')})`,
        );
      }
    }

    if (
      projectId &&
      apiKey.allowedProjectIds &&
      apiKey.allowedProjectIds.length > 0 &&
      !apiKey.allowedProjectIds.includes(projectId)
    ) {
      throw new ForbiddenException(
        'Esta API Key no tiene acceso al proyecto solicitado',
      );
    }

    const user = await this.usersService.findById(apiKey.userId);
    if (!user) {
      throw new UnauthorizedException(
        'El propietario de la API Key ya no existe',
      );
    }

    apiKey.lastUsedAt = new Date();
    apiKey.lastUsedIp = clientIp || null;
    await this.apiKeyRepository.save(apiKey);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        allowedProjectIds: apiKey.allowedProjectIds ?? null,
      },
    };
  }
}
