import type { ChildProcess } from 'node:child_process';

export interface TerminalConnectPayload {
  projectId: string;
  shell?: string;
  token?: string;
}

export interface TerminalInputPayload {
  input: string;
}

export interface TerminalResizePayload {
  cols: number;
  rows: number;
}

export interface TerminalSession {
  socketId: string;
  projectId: string;
  containerName: string;
  process: ChildProcess;
  startedAt: Date;
}
