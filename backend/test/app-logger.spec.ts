import { AppLoggerService } from '../src/shared/logger/app-logger.service';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('AppLoggerService', () => {
  let logger: AppLoggerService;
  const logDir = path.resolve(process.cwd(), 'logs');

  beforeEach(() => {
    logger = new AppLoggerService();
  });

  it('creates logs directory if missing', () => {
    expect(fs.existsSync(logDir)).toBe(true);
  });

  it('sanitizes sensitive fields (password, token, authorization)', () => {
    const rawData = {
      email: 'user@example.com',
      password: 'SecretPassword123!',
      nested: {
        token: 'jwt-access-token-string',
        authorization: 'Bearer 12345',
        safeField: 'hello world',
      },
    };

    const sanitized = logger.sanitize(rawData);

    expect(sanitized.email).toBe('user@example.com');
    expect(sanitized.password).toBe('***REDACTED***');
    expect(sanitized.nested.token).toBe('***REDACTED***');
    expect(sanitized.nested.authorization).toBe('***REDACTED***');
    expect(sanitized.nested.safeField).toBe('hello world');
  });

  it('writes INFO logs to daily app log file', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const appLogPath = path.join(logDir, `app-${today}.log`);

    const uniqueMsg = `Test info log ${Date.now()}`;
    logger.log(uniqueMsg, 'UnitTest');

    // Allow small I/O tick
    await new Promise((r) => setTimeout(r, 50));

    expect(fs.existsSync(appLogPath)).toBe(true);
    const content = fs.readFileSync(appLogPath, 'utf-8');
    expect(content).toContain(uniqueMsg);
    expect(content).toContain('UnitTest');
  });

  it('writes ERROR logs to both app log and error log files', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const errorLogPath = path.join(logDir, `error-${today}.log`);

    const uniqueError = `Test error log ${Date.now()}`;
    logger.error(uniqueError, 'Fake stack trace', 'UnitTest');

    await new Promise((r) => setTimeout(r, 50));

    expect(fs.existsSync(errorLogPath)).toBe(true);
    const content = fs.readFileSync(errorLogPath, 'utf-8');
    expect(content).toContain(uniqueError);
    expect(content).toContain('Fake stack trace');
  });
});
