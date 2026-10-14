import { Injectable, LoggerService } from '@nestjs/common';
import winston from 'winston';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level:
        process.env.LOG_LEVEL ||
        (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      silent: process.env.NODE_ENV === 'test',
      format:
        process.env.NODE_ENV === 'production'
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            )
          : winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              winston.format.colorize(),
              winston.format.printf(
                ({ timestamp, level, message, context, ...meta }) => {
                  const ctx = context ? `[${context}] ` : '';
                  const extra = Object.keys(meta).length
                    ? ` ${JSON.stringify(meta)}`
                    : '';
                  return `[TitanPaaS] ${timestamp} ${level}: ${ctx}${message}${extra}`;
                },
              ),
            ),
      transports: [new winston.transports.Console()],
    });
  }

  log(message: unknown, context?: string): void {
    this.logger.info(String(message), { context });
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error(String(message), { trace, context });
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(String(message), { context });
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(String(message), { context });
  }

  verbose(message: unknown, context?: string): void {
    this.logger.verbose(String(message), { context });
  }
}
