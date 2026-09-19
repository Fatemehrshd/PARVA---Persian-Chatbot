import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TraceContextService, TraceContextMiddleware } from '../src/shared/trace-context.service';
import { tracedFetch } from '../src/shared/traced-fetch';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditLog } from '../src/modules/audit/audit-log.entity';
import { AdminAuditController } from '../src/modules/audit/admin-audit.controller';
import { JwtAuthGuard } from '../src/shared/jwt-auth.guard';
import { AdminGuard } from '../src/shared/admin.guard';

describe('Audit Logging and SigNoz Tracing Integration', () => {
  let auditService: AuditService;
  let adminAuditController: AdminAuditController;

  const mockLogs: Partial<AuditLog>[] = [];

  const mockRepo = {
    create: jest.fn().mockImplementation((dto) => ({
      id: 'mock-uuid-' + Math.random().toString(36).slice(2, 7),
      createdAt: new Date(),
      ...dto,
    })),
    save: jest.fn().mockImplementation((entity) => {
      mockLogs.push(entity);
      return Promise.resolve(entity);
    }),
    createQueryBuilder: jest.fn().mockImplementation(() => {
      const qb: any = {
        whereClauses: [] as any[],
        parameters: {} as Record<string, any>,
        andWhere: jest.fn().mockImplementation((clause: string, params?: any) => {
          qb.whereClauses.push(clause);
          if (params) Object.assign(qb.parameters, params);
          return qb;
        }),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockImplementation(async () => {
          let filtered = [...mockLogs];
          if (qb.parameters.search) {
            const s = qb.parameters.search.replace(/%/g, '').toLowerCase();
            filtered = filtered.filter(
              (l) =>
                l.action?.toLowerCase().includes(s) ||
                l.path?.toLowerCase().includes(s) ||
                l.traceId?.toLowerCase().includes(s),
            );
          }
          if (qb.parameters.traceId) {
            const t = qb.parameters.traceId.replace(/%/g, '').toLowerCase();
            filtered = filtered.filter((l) => l.traceId?.toLowerCase().includes(t));
          }
          if (qb.whereClauses.some((c: string) => c.includes('statusCode < 400'))) {
            filtered = filtered.filter((l) => (l.statusCode ?? 200) < 400 && !l.errorMessage);
          }
          if (qb.whereClauses.some((c: string) => c.includes('statusCode >= 400'))) {
            filtered = filtered.filter(
              (l) => (l.statusCode ?? 200) >= 400 || Boolean(l.errorMessage),
            );
          }
          return [filtered, filtered.length];
        }),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          total: String(mockLogs.length),
          errors: String(mockLogs.filter((l) => (l.statusCode ?? 200) >= 400 || Boolean(l.errorMessage)).length),
          fetches: String(mockLogs.filter((l) => l.entityType === 'external_fetch').length),
          avgDuration: '45',
        }),
      };
      return qb;
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditController],
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepo,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    auditService = module.get<AuditService>(AuditService);
    adminAuditController = module.get<AdminAuditController>(AdminAuditController);
    auditService.onModuleInit();
  });

  beforeEach(() => {
    mockLogs.length = 0;
    jest.clearAllMocks();
  });

  describe('TraceContextService & Middleware', () => {
    it('generates a standard 32-hex character traceId and 16-hex spanId', () => {
      const traceId = TraceContextService.generateTraceId();
      const spanId = TraceContextService.generateSpanId();

      expect(traceId).toBeDefined();
      expect(traceId).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(traceId)).toBe(true);

      expect(spanId).toBeDefined();
      expect(spanId).toHaveLength(16);
      expect(/^[0-9a-f]{16}$/.test(spanId)).toBe(true);
    });

    it('TraceContextMiddleware extracts existing x-trace-id header and sets response header', () => {
      const middleware = new TraceContextMiddleware();
      const customTraceId = '1234567890abcdef1234567890abcdef';
      const req: any = {
        headers: { 'x-trace-id': customTraceId },
        socket: { remoteAddress: '127.0.0.1' },
      };
      const res: any = {
        headers: {} as Record<string, string>,
        setHeader: jest.fn().mockImplementation((k, v) => {
          res.headers[k.toLowerCase()] = v;
        }),
      };
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', customTraceId);
      expect(res.headers['x-trace-id']).toBe(customTraceId);
      expect(res.headers['traceparent']).toMatch(new RegExp(`^00-${customTraceId}-[0-9a-f]{16}-01$`));
    });

    it('TraceContextMiddleware generates 32-hex traceId when header is missing', () => {
      const middleware = new TraceContextMiddleware();
      const req: any = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      };
      const res: any = {
        headers: {} as Record<string, string>,
        setHeader: jest.fn().mockImplementation((k, v) => {
          res.headers[k.toLowerCase()] = v;
        }),
      };
      const next = jest.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const generatedTraceId = res.headers['x-trace-id'];
      expect(generatedTraceId).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(generatedTraceId)).toBe(true);
    });
  });

  describe('tracedFetch Outbound Calls', () => {
    it('injects x-trace-id and traceparent headers and logs external_fetch to auditService', async () => {
      const originalFetch = global.fetch;
      const mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true }),
        text: async () => '{"success": true}',
      };

      let capturedHeaders: any = null;
      (global as any).fetch = jest.fn().mockImplementation((url, init) => {
        if (typeof url === 'string' && url.includes('api.openai.com')) {
          capturedHeaders = init.headers;
        }
        return Promise.resolve(mockFetchResponse);
      });

      try {
        const customTraceId = 'abcdef1234567890abcdef1234567890';
        await new TraceContextService().runWithContext(
          { traceId: customTraceId, spanId: '1234567890abcdef' },
          async () => {
            const res = await tracedFetch(
              'https://api.openai.com/v1/chat/completions',
              {
                method: 'POST',
                body: JSON.stringify({ model: 'gpt-4o' }),
              },
              {
                name: 'ai.stream.completion',
                entityId: 'gpt-4o',
              },
            );

            expect(res.ok).toBe(true);
          },
        );

        // Verify outbound headers
        expect(capturedHeaders).toBeDefined();
        expect(capturedHeaders['x-trace-id']).toBe(customTraceId);
        expect(capturedHeaders['traceparent']).toContain(customTraceId);

        // Verify audit log entry was created
        expect(mockLogs.length).toBeGreaterThanOrEqual(1);
        const log = mockLogs.find((l) => l.action === 'ai.stream.completion');
        expect(log).toBeDefined();
        expect(log?.entityType).toBe('external_fetch');
        expect(log?.traceId).toBe(customTraceId);
        expect(log?.statusCode).toBe(200);
        expect(typeof log?.durationMs).toBe('number');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('handles outbound fetch errors gracefully and records error message in audit log', async () => {
      const originalFetch = global.fetch;
      const mockFetchResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ success: true }),
        text: async () => '{"success": true}',
      };
      (global as any).fetch = jest.fn().mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('zarinpal.com')) {
          return Promise.reject(new Error('Connection refused by peer'));
        }
        return Promise.resolve(mockFetchResponse);
      });

      try {
        await expect(
          tracedFetch('https://sandbox.zarinpal.com/pg/v4/payment/request.json', {
            method: 'POST',
          }),
        ).rejects.toThrow('Connection refused by peer');

        const errorLog = mockLogs.find((l) => l.errorMessage?.includes('Connection refused'));
        expect(errorLog).toBeDefined();
        expect(errorLog?.statusCode).toBe(500);
        expect(errorLog?.errorMessage).toBe('Connection refused by peer');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('AdminAuditController & AuditService Queries', () => {
    beforeEach(async () => {
      // Seed sample logs
      await auditService.log({
        action: 'POST /api/v1/chat/completions',
        entityType: 'http_request',
        method: 'POST',
        path: '/api/v1/chat/completions',
        statusCode: 200,
        durationMs: 120,
        traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });

      await auditService.log({
        action: 'POST /api/v1/payments/checkout',
        entityType: 'http_request',
        method: 'POST',
        path: '/api/v1/payments/checkout',
        statusCode: 400,
        durationMs: 35,
        errorMessage: 'Invalid amount',
        traceId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      });

      await auditService.log({
        action: 'payment.zarinpal.request',
        entityType: 'external_fetch',
        method: 'POST',
        path: 'https://sandbox.zarinpal.com/pg/v4/payment/request.json',
        statusCode: 200,
        durationMs: 450,
        traceId: 'cccccccccccccccccccccccccccccccc',
      });
    });

    it('returns all logs and summary statistics', async () => {
      const result = await adminAuditController.getAuditLogs();
      expect(result.items.length).toBe(3);
      expect(result.stats).toBeDefined();
      expect(result.stats?.totalLogs).toBe(3);
      expect(result.stats?.errorCount).toBe(1);
      expect(result.stats?.fetchCount).toBe(1);
    });

    it('filters logs by traceId', async () => {
      const result = await adminAuditController.getAuditLogs(undefined, undefined, undefined, 'bbbbbbbb');
      expect(result.items.length).toBe(1);
      expect(result.items[0].traceId).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    });

    it('filters logs by error status', async () => {
      const result = await adminAuditController.getAuditLogs(undefined, undefined, undefined, undefined, 'error');
      expect(result.items.length).toBe(1);
      expect(result.items[0].statusCode).toBe(400);
      expect(result.items[0].errorMessage).toBe('Invalid amount');
    });

    it('searches logs by keyword', async () => {
      const result = await adminAuditController.getAuditLogs(undefined, undefined, 'zarinpal');
      expect(result.items.length).toBe(1);
      expect(result.items[0].action).toBe('payment.zarinpal.request');
    });
  });
});
