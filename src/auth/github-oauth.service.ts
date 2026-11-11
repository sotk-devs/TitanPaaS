import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Repository } from 'typeorm';
import {
  EncryptedPayload,
  EncryptionService,
} from '../common/encryption/encryption.service.js';
import { Project } from '../projects/entities/project.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthResponse, AuthService } from './auth.service.js';
import { LinkGithubReposDto } from './dto/link-github-repos.dto.js';

export interface GithubOAuthStatePayload {
  nonce: string;
  iat: number;
  autoLink?: boolean;
  redirectUri?: string;
}

export interface GithubUserProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface GithubEmailEntry {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: string | null;
}

export interface GithubRepositoryInfo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  default_branch: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  description: string | null;
  owner?: {
    login: string;
  };
}

export interface LinkedRepositorySummary {
  projectId: string;
  name: string;
  repositoryName: string;
  repositoryUrl: string;
  branch: string;
  githubRepoId: string;
  isPrivate: boolean;
  action: 'created' | 'linked' | 'already_linked';
  webhookConfigured?: boolean;
}

export interface GithubRepositoryListItem {
  id: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  htmlUrl: string;
  defaultBranch: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  description: string | null;
  isLinked: boolean;
  linkedProjectId: string | null;
}

export interface GithubAuthResult extends AuthResponse {
  github: {
    connected: true;
    username: string;
    avatarUrl: string | null;
    isNewUser: boolean;
    autoLinkedCount: number;
    linkedRepositories: LinkedRepositorySummary[];
  };
}

interface GithubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OAUTH_BASE = 'https://github.com/login/oauth';

@Injectable()
export class GithubOAuthService {
  private readonly logger = new Logger(GithubOAuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly encryptionService: EncryptionService,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepository?: Repository<Project>,
  ) {}

  private getClientConfig(): {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
    scopes: string;
  } {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';
    const callbackUrl =
      process.env.GITHUB_CALLBACK_URL?.trim() ||
      'http://localhost:3000/auth/github/callback';
    const scopes =
      process.env.GITHUB_OAUTH_SCOPES?.trim() || 'read:user user:email repo';

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException(
        'GitHub OAuth no está configurado en el servidor (faltan GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET)',
      );
    }

    return { clientId, clientSecret, callbackUrl, scopes };
  }

  private getStateSecret(): string {
    return (
      process.env.GITHUB_STATE_SECRET ||
      process.env.JWT_SECRET ||
      'titan_paas_secret_key_change_in_prod'
    );
  }

  private validateRedirectUri(redirectUri?: string): string | undefined {
    if (!redirectUri) {
      return undefined;
    }

    const trimmed = redirectUri.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException('redirectUri no tiene un formato válido');
    }

    const isLocalhost =
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

    const configuredOrigins = [
      ...(process.env.GITHUB_ALLOWED_REDIRECT_ORIGINS || '').split(','),
      ...(process.env.CORS_ORIGIN || '').split(','),
    ]
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (isLocalhost || configuredOrigins.includes(parsed.origin)) {
      return trimmed;
    }

    throw new BadRequestException(
      'redirectUri no pertenece a un origen permitido',
    );
  }

  generateState(options?: {
    autoLink?: boolean;
    redirectUri?: string;
  }): string {
    const validatedRedirectUri = this.validateRedirectUri(options?.redirectUri);
    const payload: GithubOAuthStatePayload = {
      nonce: randomBytes(16).toString('hex'),
      iat: Date.now(),
    };
    if (options?.autoLink !== undefined) {
      payload.autoLink = options.autoLink;
    }
    if (validatedRedirectUri) {
      payload.redirectUri = validatedRedirectUri;
    }

    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString(
      'base64url',
    );
    const signature = createHmac('sha256', this.getStateSecret())
      .update(encoded)
      .digest('base64url');

    return `${encoded}.${signature}`;
  }

  verifyState(state: string): GithubOAuthStatePayload {
    const parts = state.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new UnauthorizedException('Parámetro state de OAuth inválido');
    }

    const [encoded, signature] = parts;
    const expectedSignature = createHmac('sha256', this.getStateSecret())
      .update(encoded)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature, 'utf-8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Firma de state OAuth inválida');
    }

    let payload: GithubOAuthStatePayload;
    try {
      payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf-8'),
      ) as GithubOAuthStatePayload;
    } catch {
      throw new UnauthorizedException('Contenido de state OAuth corrupto');
    }

    if (!payload.iat || Date.now() - payload.iat > STATE_TTL_MS) {
      throw new UnauthorizedException(
        'La solicitud OAuth ha expirado; inicia el flujo nuevamente',
      );
    }

    return payload;
  }

  getAuthorizationUrl(options?: { autoLink?: boolean; redirectUri?: string }): {
    authorizationUrl: string;
    state: string;
  } {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    if (!clientId) {
      throw new ServiceUnavailableException(
        'GitHub OAuth no está configurado en el servidor (falta GITHUB_CLIENT_ID)',
      );
    }

    const callbackUrl =
      process.env.GITHUB_CALLBACK_URL?.trim() ||
      'http://localhost:3000/auth/github/callback';
    const scopes =
      process.env.GITHUB_OAUTH_SCOPES?.trim() || 'read:user user:email repo';
    const state = this.generateState(options);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: scopes,
      state,
    });

    return {
      authorizationUrl: `${GITHUB_OAUTH_BASE}/authorize?${params.toString()}`,
      state,
    };
  }

  private encryptAccessToken(token: string): string {
    return JSON.stringify(this.encryptionService.encryptText(token));
  }

  private decryptAccessToken(storedToken: string | null | undefined): string {
    if (!storedToken) {
      throw new BadRequestException(
        'Tu cuenta no tiene un token de GitHub vinculado',
      );
    }

    try {
      const parsed = JSON.parse(storedToken) as EncryptedPayload;
      if (parsed && parsed.__encrypted === true) {
        return this.encryptionService.decryptText(parsed);
      }
      return storedToken;
    } catch {
      return storedToken;
    }
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const { clientId, clientSecret, callbackUrl } = this.getClientConfig();

    const response = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'TitanPaaS',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException(
        `Error comunicándose con GitHub OAuth (HTTP ${response.status})`,
      );
    }

    const data = (await response.json()) as GithubTokenResponse;
    if (data.error || !data.access_token) {
      throw new UnauthorizedException(
        data.error_description ||
          data.error ||
          'Código de autorización de GitHub inválido o expirado',
      );
    }

    return data.access_token;
  }

  private async githubRequest<T>(
    path: string,
    accessToken: string,
    init?: RequestInit,
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${GITHUB_API_BASE}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'TitanPaaS',
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new UnauthorizedException(
          'El token de acceso de GitHub es inválido o fue revocado',
        );
      }
      throw new BadGatewayException(
        `Error en la API de GitHub (${response.status}): ${message || response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  private async resolvePrimaryEmail(
    profile: GithubUserProfile,
    accessToken: string,
  ): Promise<string> {
    if (profile.email) {
      return profile.email.toLowerCase().trim();
    }

    const emails = await this.githubRequest<GithubEmailEntry[]>(
      '/user/emails',
      accessToken,
    );

    const preferred =
      emails.find((entry) => entry.primary && entry.verified) ||
      emails.find((entry) => entry.verified);

    if (!preferred?.email) {
      throw new BadRequestException(
        'La cuenta de GitHub no tiene un correo electrónico verificado disponible',
      );
    }

    return preferred.email.toLowerCase().trim();
  }

  private async fetchGithubRepositories(
    accessToken: string,
  ): Promise<GithubRepositoryInfo[]> {
    return this.githubRequest<GithubRepositoryInfo[]>(
      '/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
      accessToken,
    );
  }

  private async upsertGithubUser(
    profile: GithubUserProfile,
    email: string,
    accessToken: string,
  ): Promise<{ user: User; isNewUser: boolean }> {
    const githubId = String(profile.id);
    const encryptedToken = this.encryptAccessToken(accessToken);
    const githubData = {
      githubId,
      githubUsername: profile.login,
      avatarUrl: profile.avatar_url ?? null,
      githubAccessToken: encryptedToken,
    };

    const existingByGithubId = await this.usersService.findByGithubId(githubId);
    if (existingByGithubId) {
      const updated = await this.usersService.updateGithubProfile(
        existingByGithubId.id,
        githubData,
      );
      return { user: updated, isNewUser: false };
    }

    const existingByEmail = await this.usersService.findByEmail(email);
    if (existingByEmail) {
      const linked = await this.usersService.updateGithubProfile(
        existingByEmail.id,
        githubData,
      );
      return { user: linked, isNewUser: false };
    }

    const created = await this.usersService.create({
      email,
      password: null,
      name: profile.name?.trim() || profile.login,
      ...githubData,
    });

    return { user: created, isNewUser: true };
  }

  private resolveUniqueProjectName(
    repo: GithubRepositoryInfo,
    takenNames: Set<string>,
  ): string {
    const base = repo.name.trim();
    if (!takenNames.has(base.toLowerCase())) {
      takenNames.add(base.toLowerCase());
      return base;
    }

    const withOwner = `${repo.owner?.login || 'gh'}-${base}`.toLowerCase();
    if (!takenNames.has(withOwner)) {
      takenNames.add(withOwner);
      return `${repo.owner?.login || 'gh'}-${base}`;
    }

    const withId = `${base}-${repo.id}`;
    takenNames.add(withId.toLowerCase());
    return withId;
  }

  private findExistingProjectForRepo(
    repo: GithubRepositoryInfo,
    existingProjects: Project[],
  ): Project | undefined {
    const repoId = String(repo.id);
    const fullNameLower = repo.full_name.toLowerCase();

    return existingProjects.find(
      (project) =>
        project.githubRepoId === repoId ||
        project.repositoryName.toLowerCase() === fullNameLower,
    );
  }

  private async syncProjectWithRepo(
    project: Project,
    repo: GithubRepositoryInfo,
  ): Promise<LinkedRepositorySummary> {
    const repoId = String(repo.id);
    const needsMetadataSync =
      project.githubRepoId !== repoId ||
      Boolean(project.isPrivate) !== repo.private ||
      project.repositoryUrl !== repo.clone_url;

    if (needsMetadataSync && this.projectRepository) {
      project.githubRepoId = repoId;
      project.isPrivate = repo.private;
      project.repositoryUrl = repo.clone_url;
      await this.projectRepository.save(project);
    }

    return {
      projectId: project.id,
      name: project.name,
      repositoryName: project.repositoryName,
      repositoryUrl: project.repositoryUrl,
      branch: project.branch,
      githubRepoId: repoId,
      isPrivate: repo.private,
      action: needsMetadataSync ? 'linked' : 'already_linked',
    };
  }

  private async syncUserRepositories(
    user: User,
    accessToken: string,
    githubUsername: string,
    autoCreate: boolean,
  ): Promise<LinkedRepositorySummary[]> {
    if (!this.projectRepository) {
      return [];
    }

    let repos: GithubRepositoryInfo[];
    try {
      repos = await this.fetchGithubRepositories(accessToken);
    } catch (error) {
      this.logger.warn(
        `No se pudieron obtener repositorios de GitHub para ${githubUsername}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }

    const existingProjects = await this.projectRepository.find({
      where: { userId: user.id },
    });
    const takenNames = new Set(
      existingProjects.map((project) => project.name.toLowerCase()),
    );
    const summaries: LinkedRepositorySummary[] = [];

    for (const repo of repos) {
      const match = this.findExistingProjectForRepo(repo, existingProjects);
      if (match) {
        summaries.push(await this.syncProjectWithRepo(match, repo));
      }
    }

    if (!autoCreate) {
      return summaries;
    }

    const limit = Math.max(
      0,
      Number(process.env.GITHUB_AUTO_LINK_LIMIT ?? '20') || 20,
    );
    let createdCount = 0;

    for (const repo of repos) {
      if (createdCount >= limit) {
        break;
      }
      if (repo.archived || repo.fork) {
        continue;
      }
      if (
        repo.owner?.login &&
        repo.owner.login.toLowerCase() !== githubUsername.toLowerCase()
      ) {
        continue;
      }
      if (this.findExistingProjectForRepo(repo, existingProjects)) {
        continue;
      }

      const projectName = this.resolveUniqueProjectName(repo, takenNames);
      const newProject = this.projectRepository.create({
        name: projectName,
        repositoryUrl: repo.clone_url,
        repositoryName: repo.full_name,
        githubRepoId: String(repo.id),
        isPrivate: repo.private,
        branch: repo.default_branch || 'main',
        port: 3000,
        envVariables: {},
        userId: user.id,
      });

      const saved = await this.projectRepository.save(newProject);
      existingProjects.push(saved);
      createdCount += 1;

      summaries.push({
        projectId: saved.id,
        name: saved.name,
        repositoryName: saved.repositoryName,
        repositoryUrl: saved.repositoryUrl,
        branch: saved.branch,
        githubRepoId: String(repo.id),
        isPrivate: repo.private,
        action: 'created',
      });
    }

    return summaries;
  }

  async authenticateWithCode(
    code: string,
    state?: string,
    autoLinkOverride?: boolean,
  ): Promise<GithubAuthResult> {
    let stateAutoLink: boolean | undefined;
    if (state) {
      const parsedState = this.verifyState(state);
      stateAutoLink = parsedState.autoLink;
    }

    const accessToken = await this.exchangeCodeForToken(code);
    const profile = await this.githubRequest<GithubUserProfile>(
      '/user',
      accessToken,
    );
    const email = await this.resolvePrimaryEmail(profile, accessToken);

    const { user, isNewUser } = await this.upsertGithubUser(
      profile,
      email,
      accessToken,
    );

    const envAutoLink = process.env.GITHUB_AUTO_LINK_REPOS !== 'false';
    const shouldAutoLink = autoLinkOverride ?? stateAutoLink ?? envAutoLink;

    const linkedRepositories = await this.syncUserRepositories(
      user,
      accessToken,
      profile.login,
      shouldAutoLink,
    );

    const authResponse = await this.authService.buildAuthResponse(user);

    return {
      ...authResponse,
      github: {
        connected: true,
        username: profile.login,
        avatarUrl: profile.avatar_url ?? null,
        isNewUser,
        autoLinkedCount: linkedRepositories.filter(
          (item) => item.action === 'created' || item.action === 'linked',
        ).length,
        linkedRepositories,
      },
    };
  }

  async listUserRepositories(
    userId: string,
  ): Promise<GithubRepositoryListItem[]> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.githubAccessToken) {
      throw new BadRequestException(
        'Debes vincular tu cuenta de GitHub primero para listar repositorios',
      );
    }

    const accessToken = this.decryptAccessToken(user.githubAccessToken);
    const repos = await this.fetchGithubRepositories(accessToken);

    const existingProjects = this.projectRepository
      ? await this.projectRepository.find({ where: { userId } })
      : [];

    return repos.map((repo) => {
      const linked = this.findExistingProjectForRepo(repo, existingProjects);
      return {
        id: String(repo.id),
        name: repo.name,
        fullName: repo.full_name,
        cloneUrl: repo.clone_url,
        htmlUrl: repo.html_url,
        defaultBranch: repo.default_branch || 'main',
        private: repo.private,
        fork: repo.fork,
        archived: repo.archived,
        description: repo.description,
        isLinked: Boolean(linked),
        linkedProjectId: linked?.id ?? null,
      };
    });
  }

  private async tryConfigureRepoWebhook(
    accessToken: string,
    fullName: string,
    webhookUrl: string,
  ): Promise<boolean> {
    try {
      await this.githubRequest(`/repos/${fullName}/hooks`, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: process.env.GITHUB_WEBHOOK_SECRET || undefined,
            insecure_ssl: '0',
          },
        }),
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `No se pudo configurar el webhook para ${fullName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }

  async linkRepositories(
    userId: string,
    dto: LinkGithubReposDto,
  ): Promise<{
    linkedCount: number;
    repositories: LinkedRepositorySummary[];
  }> {
    if (!dto.all && (!dto.repositories || dto.repositories.length === 0)) {
      throw new BadRequestException(
        'Debes especificar al menos un repositorio o enviar all=true',
      );
    }

    if (!this.projectRepository) {
      throw new ServiceUnavailableException(
        'El repositorio de proyectos no está disponible',
      );
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.githubAccessToken) {
      throw new BadRequestException(
        'Debes vincular tu cuenta de GitHub antes de importar repositorios',
      );
    }

    const accessToken = this.decryptAccessToken(user.githubAccessToken);
    const allRepos = await this.fetchGithubRepositories(accessToken);

    const requestedSet = new Set(
      (dto.repositories || []).map((name) => name.toLowerCase().trim()),
    );
    const targets = dto.all
      ? allRepos.filter((repo) => !repo.archived)
      : allRepos.filter((repo) =>
          requestedSet.has(repo.full_name.toLowerCase()),
        );

    const existingProjects = await this.projectRepository.find({
      where: { userId },
    });
    const takenNames = new Set(
      existingProjects.map((project) => project.name.toLowerCase()),
    );

    const webhookUrl =
      dto.webhookUrl || process.env.GITHUB_WEBHOOK_PUBLIC_URL?.trim();
    const results: LinkedRepositorySummary[] = [];

    for (const repo of targets) {
      const existing = this.findExistingProjectForRepo(repo, existingProjects);
      let summary: LinkedRepositorySummary;

      if (existing) {
        summary = await this.syncProjectWithRepo(existing, repo);
      } else {
        const projectName = this.resolveUniqueProjectName(repo, takenNames);
        const project = this.projectRepository.create({
          name: projectName,
          repositoryUrl: repo.clone_url,
          repositoryName: repo.full_name,
          githubRepoId: String(repo.id),
          isPrivate: repo.private,
          branch: repo.default_branch || 'main',
          port: 3000,
          envVariables: {},
          userId,
        });

        const saved = await this.projectRepository.save(project);
        existingProjects.push(saved);
        summary = {
          projectId: saved.id,
          name: saved.name,
          repositoryName: saved.repositoryName,
          repositoryUrl: saved.repositoryUrl,
          branch: saved.branch,
          githubRepoId: String(repo.id),
          isPrivate: repo.private,
          action: 'created',
        };
      }

      if (dto.configureWebhook && webhookUrl) {
        summary.webhookConfigured = await this.tryConfigureRepoWebhook(
          accessToken,
          repo.full_name,
          webhookUrl,
        );
      }

      results.push(summary);
    }

    return {
      linkedCount: results.filter(
        (item) => item.action === 'created' || item.action === 'linked',
      ).length,
      repositories: results,
    };
  }

  async unlinkGithubAccount(
    userId: string,
  ): Promise<{ unlinked: true; message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (!user.githubId) {
      throw new BadRequestException(
        'La cuenta no tiene un perfil de GitHub vinculado',
      );
    }
    if (!user.password) {
      throw new BadRequestException(
        'No puedes desvincular GitHub sin una contraseña local configurada',
      );
    }

    await this.usersService.updateGithubProfile(userId, {
      githubId: null,
      githubUsername: null,
      avatarUrl: null,
      githubAccessToken: null,
    });

    return {
      unlinked: true,
      message: 'Cuenta de GitHub desvinculada exitosamente',
    };
  }
}
