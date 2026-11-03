import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { rm, mkdir } from 'node:fs/promises';
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
}

@Injectable()
export class DockerPipelineService {
  private readonly logger = new Logger(DockerPipelineService.name);

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

  async executeCommand(
    command: string,
    args: string[],
    cwd?: string,
  ): Promise<CommandExecutionResult> {
    return new Promise((resolve, reject) => {
      this.logger.debug(`Ejecutando: ${command} ${args.join(' ')}`);

      const child = spawn(command, args, {
        cwd,
        shell: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
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
  ): Promise<PipelineStepResult> {
    const start = Date.now();
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });

    const cloneResult = await this.executeCommand('git', [
      'clone',
      '--depth',
      '1',
      '--branch',
      branch,
      cloneUrl,
      targetDir,
    ]);

    let logs =
      cloneResult.stdout +
      (cloneResult.stderr ? `\n${cloneResult.stderr}` : '');

    // Si se especifica un commit SHA distinto al HEAD de la rama, intentar checkout
    if (commitSha) {
      try {
        const checkoutResult = await this.executeCommand(
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

  async buildImage(
    imageTag: string,
    contextDir: string,
  ): Promise<PipelineStepResult> {
    const start = Date.now();
    const result = await this.executeCommand(
      'docker',
      ['build', '-t', imageTag, '.'],
      contextDir,
    );

    const logs = (
      result.stdout + (result.stderr ? `\n${result.stderr}` : '')
    ).trim();

    return {
      logs,
      durationMs: Date.now() - start,
    };
  }

  async runContainer(
    imageTag: string,
    containerName: string,
    port: number,
    envVariables: Record<string, string> = {},
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

    const args = [
      'run',
      '-d',
      '--name',
      containerName,
      '-p',
      `${port}:${port}`,
      ...envArgs,
      imageTag,
    ];

    const result = await this.executeCommand('docker', args);
    const containerId = result.stdout.trim().split('\n')[0];

    return {
      containerId,
      logs: `Container ${containerName} started with ID: ${containerId}`,
      durationMs: Date.now() - start,
    };
  }

  async checkHealth(containerId: string): Promise<PipelineStepResult> {
    const start = Date.now();
    const result = await this.executeCommand('docker', [
      'inspect',
      '--format',
      '{{.State.Status}}',
      containerId,
    ]);

    const status = result.stdout.trim();
    if (status !== 'running') {
      throw new Error(`Container is not running. Current status: ${status}`);
    }

    return {
      logs: `Container health verified: ${status}`,
      durationMs: Date.now() - start,
    };
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
