import { telemetry } from './telemetry';
import { traceContextService, TraceContextService } from './trace-context.service';

export type TracedFetchAuditLogger = (entry: {
  action: string;
  entityType: string;
  entityId?: string | null;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  errorMessage?: string;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, any>;
}) => Promise<any> | void;

let globalAuditLogger: TracedFetchAuditLogger | null = null;

export function registerTracedFetchAuditLogger(logger: TracedFetchAuditLogger | null) {
  globalAuditLogger = logger;
}

export interface TracedFetchOptions {
  name?: string;
  entityId?: string;
  metadata?: Record<string, any>;
}

/**
 * Strips sensitive query parameters or URL parts for safe logging
 */
function sanitizeUrl(rawUrl: string | URL): string {
  try {
    const urlObj = typeof rawUrl === 'string' ? new URL(rawUrl) : new URL(rawUrl.toString());
    // Redact sensitive query parameters
    const sensitiveParams = ['key', 'api_key', 'apikey', 'token', 'secret', 'password'];
    for (const p of sensitiveParams) {
      if (urlObj.searchParams.has(p)) {
        urlObj.searchParams.set(p, '[REDACTED]');
      }
    }
    return urlObj.toString();
  } catch {
    return String(rawUrl);
  }
}

/**
 * Traced fetch wrapper that injects W3C traceparent and x-trace-id,
 * records an OpenTelemetry span, and logs to the audit/system log table.
 */
export async function tracedFetch(
  input: string | URL,
  init?: RequestInit,
  options?: TracedFetchOptions,
): Promise<Response> {
  const activeTraceId =
    traceContextService.getTraceId() || TraceContextService.generateTraceId();
  const parentSpanId = traceContextService.getSpanId();
  const childSpanId = TraceContextService.generateSpanId();

  const spanName = options?.name || 'http.fetch';
  const urlStr = typeof input === 'string' ? input : input.toString();
  const sanitizedUrl = sanitizeUrl(input);
  const method = (init?.method || 'GET').toUpperCase();

  const span = telemetry.startSpan(
    spanName,
    {
      'http.url': sanitizedUrl,
      'http.method': method,
      ...(options?.metadata || {}),
    },
    {
      traceId: activeTraceId,
      spanId: childSpanId,
      parentSpanId,
      kind: 3, // SPAN_KIND_CLIENT
    },
  );

  // Prepare headers preserving plain object structure for maximum compatibility
  let headers: Record<string, string> = {};
  if (init?.headers) {
    if (typeof (init.headers as any).forEach === 'function') {
      (init.headers as any).forEach((v: string, k: string) => {
        headers[k] = v;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) {
        headers[k] = v;
      }
    } else {
      headers = { ...(init.headers as Record<string, string>) };
    }
  }
  headers['x-trace-id'] = span.traceId;
  headers['traceparent'] = `00-${span.traceId}-${span.spanId}-01`;

  const startTime = Date.now();
  let statusCode = 0;
  let errorMessage: string | undefined;

  try {
    const response = await fetch(input, {
      ...init,
      headers,
    });

    statusCode = response.status;
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      errorMessage = `HTTP ${response.status} ${response.statusText}`;
      span.end('error', errorMessage);
    } else {
      span.end('ok');
    }

    if (globalAuditLogger) {
      try {
        await globalAuditLogger({
          action: spanName,
          entityType: 'external_fetch',
          entityId: options?.entityId || null,
          method,
          path: sanitizedUrl,
          statusCode,
          durationMs,
          errorMessage,
          traceId: span.traceId,
          spanId: span.spanId,
          metadata: {
            url: sanitizedUrl,
            statusText: response.statusText,
            ...(options?.metadata || {}),
          },
        });
      } catch {
        // Audit log failure must not break the external fetch
      }
    }

    return response;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    errorMessage = err?.message || String(err);
    span.end('error', errorMessage);

    if (globalAuditLogger) {
      try {
        await globalAuditLogger({
          action: spanName,
          entityType: 'external_fetch',
          entityId: options?.entityId || null,
          method,
          path: sanitizedUrl,
          statusCode: statusCode || 500,
          durationMs,
          errorMessage,
          traceId: span.traceId,
          spanId: span.spanId,
          metadata: {
            url: sanitizedUrl,
            error: errorMessage,
            ...(options?.metadata || {}),
          },
        });
      } catch {
        // Non-blocking
      }
    }

    throw err;
  }
}
