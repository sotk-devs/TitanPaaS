import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

export interface TitanConfig {
  apiUrl: string;
  token?: string;
  email?: string;
  userId?: string;
}

export class CliConfigService {
  private readonly configDir: string;
  private readonly configFile: string;

  constructor(customDir?: string) {
    this.configDir = customDir || join(homedir(), '.titan');
    this.configFile = join(this.configDir, 'config.json');
  }

  getConfig(): TitanConfig {
    const defaultConfig: TitanConfig = {
      apiUrl: process.env.TITAN_API_URL || 'http://localhost:3000',
    };

    if (!existsSync(this.configFile)) {
      return defaultConfig;
    }

    try {
      const data = JSON.parse(readFileSync(this.configFile, 'utf-8'));
      return {
        ...defaultConfig,
        ...data,
      };
    } catch {
      return defaultConfig;
    }
  }

  saveConfig(partialConfig: Partial<TitanConfig>): TitanConfig {
    const current = this.getConfig();
    const updated = { ...current, ...partialConfig };

    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    writeFileSync(this.configFile, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  clearAuth(): void {
    const current = this.getConfig();
    delete current.token;
    delete current.email;
    delete current.userId;

    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    writeFileSync(this.configFile, JSON.stringify(current, null, 2), 'utf-8');
  }

  getLocalProjectId(): string | undefined {
    const localRcPath = join(process.cwd(), '.titanrc');
    if (existsSync(localRcPath)) {
      try {
        const content = readFileSync(localRcPath, 'utf-8').trim();
        if (content.startsWith('{')) {
          const parsed = JSON.parse(content);
          return parsed.projectId || parsed.id;
        }
        return content;
      } catch {
        // ignore
      }
    }

    const localJsonPath = join(process.cwd(), 'titan.json');
    if (existsSync(localJsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(localJsonPath, 'utf-8'));
        return parsed.projectId || parsed.id;
      } catch {
        // ignore
      }
    }

    return undefined;
  }
}
