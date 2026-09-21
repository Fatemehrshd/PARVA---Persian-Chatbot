import { Injectable, LoggerService } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { telemetry } from '../telemetry';
import { traceContextService } from '../trace-context.service';

@Injectable()
export class AppLoggerService implements LoggerService {
  private logDir = path.resolve(process.cwd(), 'logs');

  constructor() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch {
      // Non-blocking initialization
    }
  }

  private writeToFile(level: string, message: any, context?: string, extra?: Record<string, any>) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const appLogFile = path.join(this.logDir, `app-${today}.log`);
      const errorLogFile = path.join(this.logDir, `error-${today}.log`);

      const traceId = traceContextService.getTraceId() || null;
      const spanId = traceContextService.getSpanId() || null;

      const logRecord = {
        timestamp: new Date().toISOString(),
        level,
        context: context || 'Application',
        traceId,
        spanId,
        message: this.sanitize(message),
        ...(extra ? { extra: this.sanitize(extra) } : {}),
      };

      const line = JSON.stringify(logRecord) + '\n';

      // Always write to daily app log
      fs.appendFile(appLogFile, line, () => {});

      // If ERROR, also write to dedicated error log file
      if (level === 'ERROR') {
        fs.appendFile(errorLogFile, line, () => {});
      }
    } catch {
      // Logging should never throw or disrupt application flow
    }
  }

  log(message: any, context?: string) {
    this.writeToFile('INFO', message, context);
    telemetry.sendLog(
      'INFO',
      typeof message === 'string' ? message : JSON.stringify(this.sanitize(message)),
      { context: context || 'App' },
    );
    console.log(`[INFO] [${context || 'App'}]`, message);
  }

  error(message: any, trace?: string, context?: string) {
    this.writeToFile('ERROR', message, context, trace ? { stack: trace } : undefined);
    telemetry.sendLog(
      'ERROR',
      typeof message === 'string' ? message : JSON.stringify(this.sanitize(message)),
      { context: context || 'App', stack: trace },
    );
    console.error(`[ERROR] [${context || 'App'}]`, message, trace || '');
  }

  warn(message: any, context?: string) {
    this.writeToFile('WARN', message, context);
    telemetry.sendLog(
      'WARN',
      typeof message === 'string' ? message : JSON.stringify(this.sanitize(message)),
      { context: context || 'App' },
    );
    console.warn(`[WARN] [${context || 'App'}]`, message);
  }

  debug(message: any, context?: string) {
    this.writeToFile('DEBUG', message, context);
    telemetry.sendLog(
      'DEBUG',
      typeof message === 'string' ? message : JSON.stringify(this.sanitize(message)),
      { context: context || 'App' },
    );
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] [${context || 'App'}]`, message);
    }
  }

  verbose(message: any, context?: string) {
    this.writeToFile('VERBOSE', message, context);
  }

  /**
   * Sanitizes sensitive fields before persisting to disk or telemetry
   */
  sanitize(data: any): any {
    const SENSITIVE_KEYS = [
      'password',
      'passwordhash',
      'token',
      'refreshtoken',
      'accesstoken',
      'authorization',
      'secret',
      'cookie',
      'apikey',
      'cardnumber',
      'cvv',
    ];

    if (data === null || data === undefined) return data;
    if (typeof data !== 'object') return data;

    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack,
      };
    }

    const copy: any = Array.isArray(data) ? [...data] : { ...data };
    for (const key of Object.keys(copy)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
        copy[key] = '***REDACTED***';
      } else if (typeof copy[key] === 'object' && copy[key] !== null) {
        copy[key] = this.sanitize(copy[key]);
      }
    }
    return copy;
  }
}
