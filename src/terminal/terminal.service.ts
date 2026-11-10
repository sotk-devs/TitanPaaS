import { Injectable, Logger } from '@nestjs/common';
import { spawn, type ChildProcess } from 'node:child_process';
import type { TerminalSession } from './interfaces/terminal-session.interface.js';

export type TerminalOutputCallback = (output: string) => void;
export type TerminalExitCallback = (code: number | null) => void;
export type TerminalErrorCallback = (error: Error) => void;

@Injectable()
export class TerminalService {
  private readonly logger = new Logger(TerminalService.name);
  private readonly sessions = new Map<string, TerminalSession>();

  spawnExec(containerName: string, shell: string = '/bin/sh'): ChildProcess {
    this.logger.debug(
      `Iniciando sesión interactiva: docker exec -i ${containerName} ${shell}`,
    );
    return spawn('docker', ['exec', '-i', containerName, shell], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
    });
  }

  startSession(
    socketId: string,
    projectId: string,
    containerName: string,
    shell: string = '/bin/sh',
    onOutput: TerminalOutputCallback,
    onExit: TerminalExitCallback,
    onError: TerminalErrorCallback,
  ): TerminalSession {
    // Si ya existe una sesión previa para este socket, cerrarla
    this.closeSession(socketId);

    const child = this.spawnExec(containerName, shell);

    const session: TerminalSession = {
      socketId,
      projectId,
      containerName,
      process: child,
      startedAt: new Date(),
    };

    this.sessions.set(socketId, session);

    child.stdout?.on('data', (chunk: Buffer) => {
      onOutput(chunk.toString());
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      onOutput(chunk.toString());
    });

    child.on('close', (code: number | null) => {
      this.logger.debug(
        `Proceso de terminal para socket ${socketId} cerrado con código ${code}`,
      );
      this.sessions.delete(socketId);
      onExit(code);
    });

    child.on('error', (err: Error) => {
      this.logger.warn(
        `Error en proceso interactivo de terminal para socket ${socketId}: ${err.message}`,
      );
      this.sessions.delete(socketId);
      onError(err);
    });

    return session;
  }

  writeInput(socketId: string, input: string): boolean {
    const session = this.sessions.get(socketId);
    if (!session || !session.process.stdin || session.process.stdin.destroyed) {
      return false;
    }

    try {
      session.process.stdin.write(input);
      return true;
    } catch (error) {
      this.logger.warn(
        `Error al escribir en stdin para socket ${socketId}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  closeSession(socketId: string): boolean {
    const session = this.sessions.get(socketId);
    if (!session) {
      return false;
    }

    try {
      if (session.process.stdin && !session.process.stdin.destroyed) {
        session.process.stdin.end();
      }
      session.process.kill();
    } catch {
      // Ignorar error al matar proceso si ya finalizó
    }

    this.sessions.delete(socketId);
    return true;
  }

  getSession(socketId: string): TerminalSession | undefined {
    return this.sessions.get(socketId);
  }

  getActiveSessionsCount(): number {
    return this.sessions.size;
  }
}
