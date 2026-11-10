import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { access, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export interface CommandExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface PipelineStepResult {
  logs: string;
  durationMs: number;
}

export interface ContainerRunResult extends PipelineStepResult {
  containerId: string;
  url?: string;
}

export interface RuntimeDetectionResult {
  hasDockerfile: boolean;
  language?: string;
  buildTool: 'docker' | 'nixpacks';
}

export type LogCallback = (chunk: string, stream: 'stdout' | 'stderr') => void;

export interface RunContainerOptions {
  subdomain?: string;
  baseDomain?: string;
  network?: string;
  labels?: Record<string, string>;
  onLog?: LogCallback;
  signal?: AbortSignal;
}

@Injectable()
export class DockerPipelineService {
  private readonly logger = new Logger(DockerPipelineService.name);
  private readonly activeDeployments = new Map<string, AbortController>();

  registerDeploymentAbort(deploymentId: string): AbortSignal {
    const controller = new AbortController();
    this.activeDeployments.set(deploymentId, controller);
    return controller.signal;
  }

  unregisterDeploymentAbort(deploymentId: string): void {
    this.activeDeployments.delete(deploymentId);
  }

  abortDeployment(deploymentId: string): boolean {
    const controller = this.activeDeployments.get(deploymentId);
    if (controller) {
      controller.abort();
      this.activeDeployments.delete(deploymentId);
      return true;
    }
    return false;
  }

  getWorkspacePath(repositoryName: string, commitSha: string): string {
    const sanitizedRepo = repositoryName.replace(/[^a-zA-Z0-9]/g, '_');
    const shortSha = commitSha.substring(0, 10);
    return join(tmpdir(), 'titan-paas', 'builds', sanitizedRepo, shortSha);
  }

  generateImageTag(repositoryName: string, commitSha: string): string {
    const sanitizedRepo = repositoryName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    const shortSha = commitSha.substring(0, 7);
    return `titan-${sanitizedRepo}:${shortSha}`;
  }

  generateContainerName(repositoryName: string): string {
    const sanitizedRepo = repositoryName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    return `titan-app-${sanitizedRepo}`;
  }

  generateSubdomain(name: string): string {
    const rawName = name.includes('/') ? name.split('/').pop() || name : name;
    return rawName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async executeCommand(
    command: string,
    args: string[],
    cwd?: string,
    onLog?: LogCallback,
    signal?: AbortSignal,
  ): Promise<CommandExecutionResult> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Ejecutando: ${command} ${args.join(' ')}`);

      const child = spawn(command, args, {
        cwd,
        shell: true,
        signal,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        onLog?.(text, 'stdout');
      });

      child.stderr?.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        onLog?.(text, 'stderr');
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (exitCode) => {
        if (exitCode !== 0) {
          const errorMessage =
            stderr || stdout || `Process exited with code ${exitCode}`;
          reject(new Error(errorMessage));
        } else {
          resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
        }
      });
    });
  }

  async cloneRepository(
    cloneUrl: string,
    branch: string,
    commitSha: string,
    targetDir: string,
    onLog?: LogCallback,
    signal?: AbortSignal,
  ): Promise<PipelineStepResult> {
    const start = Date.now();
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });

    const cloneArgs = [
      'clone',
      '--depth',
      '1',
      '--branch',
      branch,
      cloneUrl,
      targetDir,
    ];

    const cloneResult = signal
      ? await this.executeCommand('git', cloneArgs, undefined, onLog, signal)
      : onLog
        ? await this.executeCommand('git', cloneArgs, undefined, onLog)
        : await this.executeCommand('git', cloneArgs);

    let logs =
      cloneResult.stdout +
      (cloneResult.stderr ? `\n${cloneResult.stderr}` : '');

    // Si se especifica un commit SHA distinto al HEAD de la rama, intentar checkout
    if (commitSha) {
      try {
        const checkoutResult = signal
          ? await this.executeCommand(
              'git',
              ['checkout', commitSha],
              targetDir,
              onLog,
              signal,
            )
          : onLog
            ? await this.executeCommand(
                'git',
                ['checkout', commitSha],
                targetDir,
                onLog,
              )
            : await this.executeCommand(
                'git',
                ['checkout', commitSha],
                targetDir,
              );
        logs += `\n${checkoutResult.stdout}${checkoutResult.stderr ? `\n${checkoutResult.stderr}` : ''}`;
      } catch {
        // En clones superficiales depth=1 el commit específico ya es el head de la rama
      }
    }

    return {
      logs: logs.trim(),
      durationMs: Date.now() - start,
    };
  }

  async hasDockerfile(contextDir: string): Promise<boolean> {
    const candidates = ['Dockerfile', 'dockerfile'];
    for (const file of candidates) {
      try {
        await access(join(contextDir, file));
        return true;
      } catch (error) {
        void error;
      }
    }
    return false;
  }

  async detectRuntime(contextDir: string): Promise<RuntimeDetectionResult> {
    if (await this.hasDockerfile(contextDir)) {
      return {
        hasDockerfile: true,
        buildTool: 'docker',
      };
    }

    const checks: Array<{ language: string; files: string[] }> = [
      { language: 'Node.js', files: ['package.json'] },
      {
        language: 'Python',
        files: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py'],
      },
      { language: 'Go', files: ['go.mod', 'main.go'] },
      { language: 'Rust', files: ['Cargo.toml'] },
      { language: 'PHP', files: ['composer.json', 'index.php'] },
      {
        language: 'Java',
        files: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
      },
      { language: 'Ruby', files: ['Gemfile'] },
      { language: 'Deno', files: ['deno.json', 'deno.jsonc'] },
      { language: 'Elixir', files: ['mix.exs'] },
    ];

    for (const check of checks) {
      for (const file of check.files) {
        try {
          await access(join(contextDir, file));
          return {
            hasDockerfile: false,
            language: check.language,
            buildTool: 'nixpacks',
          };
        } catch (error) {
          void error;
        }
      }
    }

    return {
      hasDockerfile: false,
      language: 'Unknown',
      buildTool: 'nixpacks',
    };
  }

  async buildWithDocker(
    imageTag: string,
    contextDir: string,
    onLog?: LogCallback,
    signal?: AbortSignal,
  ): Promise<PipelineStepResult> {
    const start = Date.now();
    const buildArgs = ['build', '-t', imageTag, '.'];
    const result = signal
      ? await this.executeCommand(
          'docker',
          buildArgs,
          contextDir,
          onLog,
          signal,
        )
      : onLog
        ? await this.executeCommand('docker', buildArgs, contextDir, onLog)
        : await this.executeCommand('docker', buildArgs, contextDir);

    const logs = (
      result.stdout + (result.stderr ? `\n${result.stderr}` : '')
    ).trim();

    return {
      logs,
      durationMs: Date.now() - start,
    };
  }

  async buildWithNixpacks(
    imageTag: string,
    contextDir: string,
    onLog?: LogCallback,
  ): Promise<PipelineStepResult> {
    const start = Date.now();
    const nixpacksArgs = ['build', '.', '--name', imageTag];
    const result = onLog
      ? await this.executeCommand('nixpacks', nixpacksArgs, contextDir, onLog)
      : await this.executeCommand('nixpacks', nixpacksArgs, contextDir);

    const logs = (
      result.stdout + (result.stderr ? `\n${result.stderr}` : '')
    ).trim();

    return {
      logs,
      durationMs: Date.now() - start,
    };
  }

  async buildImage(
    imageTag: string,
    contextDir: string,
    onLog?: LogCallback,
  ): Promise<PipelineStepResult> {
    const runtime = await this.detectRuntime(contextDir);

    if (runtime.hasDockerfile) {
      onLog?.(
        'Dockerfile detected. Using Docker build pipeline...\n',
        'stdout',
      );
      return this.buildWithDocker(imageTag, contextDir, onLog);
    }

    const langMsg =
      runtime.language && runtime.language !== 'Unknown'
        ? `No Dockerfile found. Auto-detected ${runtime.language} runtime. Using Nixpacks build pipeline...\n`
        : 'No Dockerfile found. Using Nixpacks build pipeline...\n';
    onLog?.(langMsg, 'stdout');

    return this.buildWithNixpacks(imageTag, contextDir, onLog);
  }

  async runContainer(
    imageTag: string,
    containerName: string,
    port: number,
    envVariables: Record<string, string> = {},
    optionsOrOnLog?: RunContainerOptions | LogCallback,
    onLogCallback?: LogCallback,
  ): Promise<ContainerRunResult> {
    const start = Date.now();

    // Detener y remover contenedor previo con el mismo nombre si existe
    try {
      await this.executeCommand('docker', ['rm', '-f', containerName]);
    } catch {
      // Ignorar error si no existía el contenedor previo
    }

    const envArgs: string[] = [];
    for (const [key, val] of Object.entries(envVariables)) {
      envArgs.push('-e', `${key}=${val}`);
    }

    const isCallback = typeof optionsOrOnLog === 'function';
    const options: RunContainerOptions | undefined = isCallback
      ? undefined
      : optionsOrOnLog;
    const onLog: LogCallback | undefined = isCallback
      ? optionsOrOnLog
      : (options?.onLog ?? onLogCallback);
    const signal: AbortSignal | undefined = options?.signal;

    const labelArgs: string[] = [];
    let url: string | undefined;
    const network = options?.network;

    if (options?.subdomain) {
      const baseDomain =
        options.baseDomain || process.env.BASE_DOMAIN || 'localhost';
      const subdomain = options.subdomain;
      const routerName = containerName.replace(/[^a-zA-Z0-9_-]/g, '-');
      url = `http://${subdomain}.${baseDomain}`;

      const traefikLabels: Record<string, string> = {
        'traefik.enable': 'true',
        [`traefik.http.routers.${routerName}.rule`]: `Host(\`${subdomain}.${baseDomain}\`)`,
        [`traefik.http.routers.${routerName}.entrypoints`]: 'web',
        [`traefik.http.services.${routerName}.loadbalancer.server.port`]:
          String(port),
        ...(network ? { 'traefik.docker.network': network } : {}),
        ...options.labels,
      };

      for (const [key, val] of Object.entries(traefikLabels)) {
        labelArgs.push('--label', `${key}=${val}`);
      }
    } else if (options?.labels) {
      for (const [key, val] of Object.entries(options.labels)) {
        labelArgs.push('--label', `${key}=${val}`);
      }
    }

    const networkArgs: string[] = network ? ['--network', network] : [];

    const args = [
      'run',
      '-d',
      '--name',
      containerName,
      ...networkArgs,
      '-p',
      `${port}:${port}`,
      ...labelArgs,
      ...envArgs,
      imageTag,
    ];

    const result = signal
      ? await this.executeCommand('docker', args, undefined, onLog, signal)
      : onLog
        ? await this.executeCommand('docker', args, undefined, onLog)
        : await this.executeCommand('docker', args);
    const containerId = result.stdout.trim().split('\n')[0];

    const logs = url
      ? `Container ${containerName} started with ID: ${containerId} (routed at ${url})`
      : `Container ${containerName} started with ID: ${containerId}`;

    return {
      containerId,
      url,
      logs,
      durationMs: Date.now() - start,
    };
  }

  async checkHealth(
    containerId: string,
    onLog?: LogCallback,
    signal?: AbortSignal,
  ): Promise<PipelineStepResult> {
    const start = Date.now();
    const inspectArgs = [
      'inspect',
      '--format',
      '{{.State.Status}}',
      containerId,
    ];
    const result = signal
      ? await this.executeCommand(
          'docker',
          inspectArgs,
          undefined,
          onLog,
          signal,
        )
      : onLog
        ? await this.executeCommand('docker', inspectArgs, undefined, onLog)
        : await this.executeCommand('docker', inspectArgs);

    const status = result.stdout.trim();
    if (status !== 'running') {
      throw new Error(`Container is not running. Current status: ${status}`);
    }

    return {
      logs: `Container health verified: ${status}`,
      durationMs: Date.now() - start,
    };
  }

  async stopContainer(containerIdOrName: string): Promise<PipelineStepResult> {
    const start = Date.now();
    const result = await this.executeCommand('docker', [
      'stop',
      containerIdOrName,
    ]);
    return {
      logs: result.stdout.trim() || `Container ${containerIdOrName} stopped`,
      durationMs: Date.now() - start,
    };
  }

  async startContainer(containerIdOrName: string): Promise<PipelineStepResult> {
    const start = Date.now();
    const result = await this.executeCommand('docker', [
      'start',
      containerIdOrName,
    ]);
    return {
      logs: result.stdout.trim() || `Container ${containerIdOrName} started`,
      durationMs: Date.now() - start,
    };
  }

  async restartContainer(
    containerIdOrName: string,
  ): Promise<PipelineStepResult> {
    const start = Date.now();
    const result = await this.executeCommand('docker', [
      'restart',
      containerIdOrName,
    ]);
    return {
      logs: result.stdout.trim() || `Container ${containerIdOrName} restarted`,
      durationMs: Date.now() - start,
    };
  }

  async getContainerStatus(containerIdOrName: string): Promise<string> {
    try {
      const result = await this.executeCommand('docker', [
        'inspect',
        '--format',
        '{{.State.Status}}',
        containerIdOrName,
      ]);
      return result.stdout.trim();
    } catch {
      return 'not_found';
    }
  }

  async cleanup(targetDir: string): Promise<void> {
    try {
      await rm(targetDir, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(
        `Error limpiando directorio temporal ${targetDir}: ${(error as Error).message}`,
      );
    }
  }
}
