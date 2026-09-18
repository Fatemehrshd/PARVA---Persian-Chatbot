import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Optional } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Response, Request } from 'express';
import { mergeMap } from 'rxjs/operators';
import { ChatService } from '../modules/chat/chat.service';

export interface ApiResponseEnvelope<T = any> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  ApiResponseEnvelope<T> | T
> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponseEnvelope<T> | T> {
    const http = context.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();

    // Skip intercepting for Server-Sent Events (SSE) streaming responses and OpenAI-compatible endpoints
    const accept = (req.headers?.['accept'] as string) ?? '';
    const contentType = (res.getHeader?.('content-type') as string) ?? '';
    if (
      accept.includes('text/event-stream') ||
      contentType.includes('text/event-stream') ||
      res.headersSent ||
      req.url?.includes('/v1/models') ||
      req.url?.includes('/v1/chat/completions')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Skip modifying 204 No Content responses
        if (
          res.statusCode === 204 ||
          (data === undefined &&
            res.statusCode >= 200 &&
            res.statusCode < 300 &&
            req.method === 'DELETE')
        ) {
          return data;
        }

        // If data is already enveloped, return as-is
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'data' in data &&
          'message' in data
        ) {
          return data;
        }

        return {
          success: true,
          message: 'Operation successful',
          data: data ?? null,
        };
      }),
    );
  }
}

@Injectable()
export class QuotaInterceptor implements NestInterceptor {
  constructor(@Optional() private chat?: ChatService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const userId = request?.user?.sub;
    if (!userId || !this.chat || typeof (this.chat as any).getQuotaState !== 'function') return next.handle();

    return next.handle().pipe(
      mergeMap((value) =>
        from(Promise.resolve().then(() => this.chat?.getQuotaState(userId)).catch(() => null)).pipe(
          map((state) => {
            try {
              if (state) response.setHeader('X-User-Quota', Buffer.from(JSON.stringify(state)).toString('base64'));
            } catch {
              // Quota telemetry must never break the original response.
            }
            return value;
          }),
        ),
      ),
    );
  }
}
