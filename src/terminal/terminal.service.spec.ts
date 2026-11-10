import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { TerminalService } from './terminal.service.js';

describe('TerminalService', () => {
  let service: TerminalService;
  let mockProcess: any;

  beforeEach(() => {
    service = new TerminalService();

    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = {
      write: jest.fn().mockReturnValue(true),
      end: jest.fn(),
      destroyed: false,
    };
    mockProcess.kill = jest.fn();

    jest.spyOn(service, 'spawnExec').mockReturnValue(mockProcess as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startSession', () => {
    it('should spawn process, store session, and attach event listeners', () => {
      const onOutput = jest.fn();
      const onExit = jest.fn();
      const onError = jest.fn();

      const session = service.startSession(
        'socket-123',
        'proj-abc',
        'titan-app-test',
        '/bin/sh',
        onOutput,
        onExit,
        onError,
      );

      expect(session).toBeDefined();
      expect(session.socketId).toBe('socket-123');
      expect(session.containerName).toBe('titan-app-test');
      expect(service.getActiveSessionsCount()).toBe(1);

      // Verify stdout streaming
      mockProcess.stdout.emit('data', Buffer.from('hello terminal'));
      expect(onOutput).toHaveBeenCalledWith('hello terminal');

      // Verify stderr streaming
      mockProcess.stderr.emit('data', Buffer.from('warning text'));
      expect(onOutput).toHaveBeenCalledWith('warning text');

      // Verify process error
      const testError = new Error('Process crash');
      mockProcess.emit('error', testError);
      expect(onError).toHaveBeenCalledWith(testError);
      expect(service.getActiveSessionsCount()).toBe(0);
    });

    it('should handle process close event and delete session', () => {
      const onOutput = jest.fn();
      const onExit = jest.fn();
      const onError = jest.fn();

      service.startSession(
        'socket-123',
        'proj-abc',
        'titan-app-test',
        '/bin/sh',
        onOutput,
        onExit,
        onError,
      );

      expect(service.getActiveSessionsCount()).toBe(1);

      mockProcess.emit('close', 0);
      expect(onExit).toHaveBeenCalledWith(0);
      expect(service.getActiveSessionsCount()).toBe(0);
    });

    it('should close previous session if one already exists for socket', () => {
      const onOutput = jest.fn();
      const onExit = jest.fn();
      const onError = jest.fn();

      service.startSession(
        'socket-123',
        'proj-abc',
        'titan-app-test',
        '/bin/sh',
        onOutput,
        onExit,
        onError,
      );

      const closeSpy = jest.spyOn(service, 'closeSession');

      service.startSession(
        'socket-123',
        'proj-abc-2',
        'titan-app-test-2',
        '/bin/sh',
        onOutput,
        onExit,
        onError,
      );

      expect(closeSpy).toHaveBeenCalledWith('socket-123');
      expect(service.getActiveSessionsCount()).toBe(1);
    });
  });

  describe('writeInput', () => {
    it('should write input to session stdin and return true', () => {
      service.startSession(
        'socket-123',
        'proj-abc',
        'titan-app-test',
        '/bin/sh',
        jest.fn(),
        jest.fn(),
        jest.fn(),
      );

      const success = service.writeInput('socket-123', 'ls -la\n');

      expect(success).toBe(true);
      expect(mockProcess.stdin.write).toHaveBeenCalledWith('ls -la\n');
    });

    it('should return false if session does not exist', () => {
      const success = service.writeInput('unknown-socket', 'ls\n');
      expect(success).toBe(false);
    });

    it('should return false if stdin is destroyed', () => {
      service.startSession(
        'socket-123',
        'proj-abc',
        'titan-app-test',
        '/bin/sh',
        jest.fn(),
        jest.fn(),
        jest.fn(),
      );

      mockProcess.stdin.destroyed = true;
      const success = service.writeInput('socket-123', 'ls\n');
      expect(success).toBe(false);
    });

    it('should handle write errors gracefully and return false', () => {
      service.startSession(
        'socket-123',
        'proj-abc',
        'titan-app-test',
        '/bin/sh',
        jest.fn(),
        jest.fn(),
        jest.fn(),
      );

      mockProcess.stdin.write.mockImplementation(() => {
        throw new Error('Pipe broken');
      });

      const success = service.writeInput('socket-123', 'ls\n');
      expect(success).toBe(false);
    });
  });

  describe('closeSession and getSession', () => {
    it('should kill process, end stdin, and delete session', () => {
      service.startSession(
        'socket-123',
        'proj-abc',
        'titan-app-test',
        '/bin/sh',
        jest.fn(),
        jest.fn(),
        jest.fn(),
      );

      expect(service.getSession('socket-123')).toBeDefined();

      const success = service.closeSession('socket-123');

      expect(success).toBe(true);
      expect(mockProcess.stdin.end).toHaveBeenCalled();
      expect(mockProcess.kill).toHaveBeenCalled();
      expect(service.getSession('socket-123')).toBeUndefined();
    });

    it('should return false if session to close does not exist', () => {
      const success = service.closeSession('non-existent');
      expect(success).toBe(false);
    });
  });
});
