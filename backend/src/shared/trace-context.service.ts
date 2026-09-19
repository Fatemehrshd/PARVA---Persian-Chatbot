import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

@Injectable()
export class TraceContextService {
  /**
   * Generates a standard W3C 32-hex character trace ID (16 bytes)
   */
  static generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generates a standard W3C 16-hex character span ID (8 bytes)
   */
  static generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }

  /**
   * Get current context
   */
  getContext(): TraceContext | undefined {
    return traceStorage.getStore();
  }

  /**
   * Get active trace ID or return undefined
   */
  getTraceId(): string | undefined {
    return traceStorage.getStore()?.traceId;
  }

  /**
   * Get active span ID or return undefined
   */
  getSpanId(): string | undefined {
    return traceStorage.getStore()?.spanId;
  }

  /**
   * Get active parent span ID or return undefined
   */
  getParentSpanId(): string | undefined {
    return traceStorage.getStore()?.parentSpanId;
  }

  /**
   * Run a function within a specified trace context
   */
  runWithContext<T>(context: TraceContext, fn: () => T): T {
    return traceStorage.run(context, fn);
  }
}

export const traceContextService = new TraceContextService();

@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let traceId: string | undefined;
    let parentSpanId: string | undefined;

    // 1. Check for W3C traceparent header: 00-<trace_id>-<span_id>-<flags>
    const traceparent = req.headers['traceparent'];
    if (typeof traceparent === 'string') {
      const parts = traceparent.trim().split('-');
      if (parts.length >= 4 && parts[1]?.length === 32) {
        traceId = parts[1];
        if (parts[2]?.length === 16) {
          parentSpanId = parts[2];
        }
      }
    }

    // 2. Check for x-trace-id header
    if (!traceId) {
      const xTraceId = req.headers['x-trace-id'];
      if (typeof xTraceId === 'string' && xTraceId.trim().length > 0) {
        traceId = xTraceId.trim();
      }
    }

    // 3. Fallback: generate standard 32-hex trace ID
    if (!traceId) {
      traceId = TraceContextService.generateTraceId();
    }

    // Generate root server span ID for this request
    const spanId = TraceContextService.generateSpanId();

    // Set response header so client / admin knows the trace ID and server span
    res.setHeader('x-trace-id', traceId);
    res.setHeader('traceparent', `00-${traceId}-${spanId}-01`);

    const context: TraceContext = {
      traceId,
      spanId,
      parentSpanId,
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined,
      userAgent: req.headers['user-agent'] || undefined,
    };

    traceStorage.run(context, () => {
      next();
    });
  }
}
