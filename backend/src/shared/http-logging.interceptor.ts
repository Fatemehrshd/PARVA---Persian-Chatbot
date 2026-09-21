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

    const ip =
      (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    const resolveActorInfo = () => {
      let user = (req as any).user;
      if (!user) {
        const authHeader = req.headers['authorization'] as string;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.slice(7).trim();
            const parts = token.split('.');
            if (parts.length === 3) {
              const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8');
              const decoded = JSON.parse(payloadStr);
              if (decoded && typeof decoded === 'object') {
                user = {
                  id: decoded.id || decoded.sub,
                  email: decoded.email,
                  displayName: decoded.displayName || decoded.name,
                  role: decoded.role,
                };
              }
            }
          } catch {
            // Ignore malformed token decode
          }
        }
      }

      const actorId = user?.id || user?.sub || null;
      const actorEmail =
        user?.email ??
        (req.body && typeof req.body.email === 'string' ? req.body.email : null);
      const actorName = user?.displayName || user?.name || user?.username || null;
      const actorType = user?.role === 'admin' ? 'admin' : user ? 'user' : 'system';
      return { actorId, actorEmail, actorName, actorType };
    };

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = res.statusCode || 200;
          span.end('ok');

          const { actorId, actorEmail, actorName, actorType } = resolveActorInfo();

          // 1. Dispatch OTLP Log to SigNoz Logs Engine (ClickHouse)
          telemetry.sendLog(
            statusCode >= 400 ? 'WARN' : 'INFO',
            `${method} ${path} - ${statusCode} (${durationMs}ms)`,
            {
              'http.method': method,
              'http.url': rawUrl,
              'http.route': path,
              'http.status_code': statusCode,
              'http.duration_ms': durationMs,
              'client.ip': ip,
              'user.id': actorId,
              'user.email': actorEmail,
            },
            span.traceId,
            span.spanId,
          );

          // 2. Persist business audit log in PostgreSQL
          // Only state-changing operations (POST, PUT, PATCH, DELETE) or error statuses are persisted to PostgreSQL.
          // Mundane read queries (successful GET) are streamed to SigNoz and file logs only to prevent database bloat.
          const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
          const isAuditWorthy = isStateChanging || statusCode >= 400;

          // Exclude regular chat messages (user or admin sending messages to chat) from audit log
          const isChatMessaging =
            path.includes('/messages') ||
            path.includes('/chat/conversations') ||
            path.includes('/chat/completions') ||
            path.startsWith('/chat') ||
            path.startsWith('/api/chat') ||
            path.startsWith('/api/v1/chat');

          // Exclude successful payment checkout/verify from generic HTTP audit logs (PaymentsService creates dedicated domain logs)
          const isPaymentDomainRoute =
            statusCode < 400 &&
            (path.includes('/payments/checkout') || path.includes('/payments/verify'));

          if (this.auditService && isAuditWorthy && !isChatMessaging && !isPaymentDomainRoute) {
            this.auditService
              .log({
                traceId: span.traceId || traceContextService.getTraceId(),
                spanId: span.spanId || traceContextService.getSpanId(),
                actorId,
                actorEmail,
                actorName,
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

          const { actorId, actorEmail, actorName, actorType } = resolveActorInfo();

          // 1. Dispatch OTLP Error Log to SigNoz Logs Engine (ClickHouse)
          telemetry.sendLog(
            'ERROR',
            `${method} ${path} FAILED (${statusCode}): ${errorMessage}`,
            {
              'http.method': method,
              'http.url': rawUrl,
              'http.route': path,
              'http.status_code': statusCode,
              'http.duration_ms': durationMs,
              'error.message': errorMessage,
              'client.ip': ip,
              'user.id': actorId,
              'user.email': actorEmail,
            },
            span.traceId,
            span.spanId,
          );

          // 2. Persist error audit log in PostgreSQL (excluding regular chat messaging)
          const isChatMessaging =
            path.includes('/messages') ||
            path.includes('/chat/conversations') ||
            path.includes('/chat/completions') ||
            path.startsWith('/chat') ||
            path.startsWith('/api/chat') ||
            path.startsWith('/api/v1/chat');

          if (this.auditService && !isChatMessaging) {
            this.auditService
              .log({
                traceId: span.traceId || traceContextService.getTraceId(),
                spanId: span.spanId || traceContextService.getSpanId(),
                actorId,
                actorEmail,
                actorName,
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
