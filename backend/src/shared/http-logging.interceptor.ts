import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { telemetry } from './telemetry';
import { AuditService } from '../modules/audit/audit.service';
import { traceContextService, TraceContextService } from './trace-context.service';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(
    @Optional()
    private readonly auditService?: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const rawUrl = req.originalUrl || req.url || '';

    // Ignore noise: static assets, favicon, health check, and fetching audit logs themselves
    if (
      rawUrl.startsWith('/api/v1/admin/audit-logs') ||
      rawUrl.startsWith('/admin/audit-logs') ||
      rawUrl.includes('/health') ||
      rawUrl.endsWith('.ico') ||
      rawUrl.endsWith('.js') ||
      rawUrl.endsWith('.css')
    ) {
      return next.handle();
    }

    const startTime = Date.now();
    const method = req.method;
    const path = rawUrl.split('?')[0];

    const activeTraceId =
      traceContextService.getTraceId() || TraceContextService.generateTraceId();
    const activeSpanId =
      traceContextService.getSpanId() || TraceContextService.generateSpanId();
    const incomingParentSpanId = traceContextService.getParentSpanId();

    const span = telemetry.startSpan(
      'http.server.request',
      {
        'http.method': method,
        'http.url': rawUrl,
        'http.path': path,
        'http.route': path,
      },
      {
        traceId: activeTraceId,
        spanId: activeSpanId,
        parentSpanId: incomingParentSpanId,
        kind: 2, // SPAN_KIND_SERVER
      },
    );

    const actor = (req as any).user;
    const actorId = actor?.id ?? null;
    const actorType = actor?.role === 'admin' ? 'admin' : actor ? 'user' : 'system';
    const ip =
      (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode || 200;
          span.end('ok');

          if (this.auditService) {
            this.auditService
              .log({
                traceId: span.traceId || traceContextService.getTraceId(),
                spanId: span.spanId || traceContextService.getSpanId(),
                actorId,
                actorType,
                action: `${method} ${path}`,
                entityType: 'http_request',
                entityId: path,
                method,
                path: rawUrl,
                statusCode,
                durationMs,
                ip,
                userAgent,
                metadata: {
                  query: req.query,
                  params: req.params,
                },
              })
              .catch(() => {});
          }
        },
        error: (err: any) => {
          const durationMs = Date.now() - startTime;
          const statusCode = err?.status || err?.statusCode || 500;
          const errorMessage = err?.message || String(err);
          span.end('error', errorMessage);

          if (this.auditService) {
            this.auditService
              .log({
                traceId: span.traceId || traceContextService.getTraceId(),
                spanId: span.spanId || traceContextService.getSpanId(),
                actorId,
                actorType,
                action: `${method} ${path} (FAILED)`,
                entityType: 'http_request',
                entityId: path,
                method,
                path: rawUrl,
                statusCode,
                durationMs,
                errorMessage,
                ip,
                userAgent,
                metadata: {
                  query: req.query,
                  params: req.params,
                },
              })
              .catch(() => {});
          }
        },
      }),
    );
  }
}
