import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { traceContextService } from './trace-context.service';

export interface TraceSpan {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  kind?: number;
  startTime: number;
  attributes: Record<string, any>;
  end: (status?: 'ok' | 'error', errorMsg?: string) => void;
}

class TelemetryService {
  private readonly logger = new Logger('TelemetryService');
  private readonly otlpUrl =
    process.env.SIGNOZ_OTLP_URL ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://localhost:4318/v1/traces';
  private readonly otlpLogsUrl =
    process.env.SIGNOZ_OTLP_LOGS_URL ||
    (this.otlpUrl.includes('/v1/traces')
      ? this.otlpUrl.replace('/v1/traces', '/v1/logs')
      : 'http://localhost:4318/v1/logs');
  // Enabled by default unless explicitly set to 'false'
  private readonly isEnabled = process.env.ENABLE_TELEMETRY !== 'false';

  startSpan(
    name: string,
    attributes: Record<string, any> = {},
    options?: {
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
      kind?: number;
    },
  ): TraceSpan {
    const activeTraceId =
      options?.traceId ||
      traceContextService.getTraceId() ||
      randomBytes(16).toString('hex');

    // If parentSpanId is explicitly specified, use it.
    // Otherwise, if options.spanId was passed (like in server requests), use getParentSpanId() (which is undefined for roots).
    // Otherwise, use getSpanId() (making this span a child of the current context span).
    const parentSpanId =
      options?.parentSpanId !== undefined
        ? options.parentSpanId
        : options?.spanId
          ? traceContextService.getParentSpanId()
          : traceContextService.getSpanId();

    const spanId = options?.spanId || randomBytes(8).toString('hex');
    // OpenTelemetry span kinds: 1=INTERNAL, 2=SERVER, 3=CLIENT, 4=PRODUCER, 5=CONSUMER
    const kind = options?.kind ?? (parentSpanId ? 3 : 2);
    const startTime = Date.now();

    return {
      name,
      traceId: activeTraceId,
      spanId,
      parentSpanId,
      kind,
      startTime,
      attributes,
      end: (status = 'ok', errorMsg?: string) => {
        const duration = Math.max(1, Date.now() - startTime);
        if (errorMsg) {
          attributes['error.message'] = errorMsg;
        }
        attributes['status'] = status;
        attributes['duration_ms'] = duration;

        if (this.isEnabled) {
          this.sendOtlpSpan(
            name,
            activeTraceId,
            spanId,
            parentSpanId,
            kind,
            startTime,
            duration,
            status,
            attributes,
          ).catch((err) => {
            this.logger.debug(`Non-blocking telemetry export error: ${err.message}`);
          });
        }
      },
    };
  }

  private async sendOtlpSpan(
    name: string,
    traceId: string,
    spanId: string,
    parentSpanId: string | undefined,
    kind: number,
    startTime: number,
    durationMs: number,
    status: string,
    attributes: Record<string, any>,
  ) {
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_TELEMETRY_IN_TEST) {
      return;
    }

    try {
      const safeDuration = Math.max(1, durationMs);
      const spanObj: any = {
        traceId,
        spanId,
        name,
        kind,
        startTimeUnixNano: String(BigInt(startTime) * BigInt(1_000_000)),
        endTimeUnixNano: String(BigInt(startTime + safeDuration) * BigInt(1_000_000)),
        status: {
          code: status === 'ok' ? 1 : 2,
          message: attributes['error.message'],
        },
        attributes: Object.entries(attributes).map(([k, v]) => ({
          key: k,
          value:
            typeof v === 'number'
              ? { intValue: v }
              : typeof v === 'boolean'
                ? { boolValue: v }
                : { stringValue: String(v ?? '') },
        })),
      };

      // CRITICAL: SigNoz / ClickHouse requires parent_span_id to be omitted or empty
      // for root spans so they appear in root_operations and flamegraph.
      if (parentSpanId && parentSpanId.trim().length > 0) {
        spanObj.parentSpanId = parentSpanId.trim();
      }

      const payload = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'codeless-backend' } },
                { key: 'service.environment', value: { stringValue: process.env.NODE_ENV || 'development' } },
              ],
            },
            scopeSpans: [
              {
                scope: { name: 'codeless-tracer', version: '1.0.0' },
                spans: [spanObj],
              },
            ],
          },
        ],
      };

      if (typeof fetch === 'function') {
        const res = await fetch(this.otlpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          this.logger.warn(`SigNoz OTLP export returned ${res.status}: ${errText}`);
        }
      }
    } catch (err: any) {
      this.logger.debug(`Failed to dispatch span to SigNoz: ${err?.message}`);
    }
  }

  async sendLog(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string,
    attributes: Record<string, any> = {},
    traceId?: string,
    spanId?: string,
  ) {
    if (!this.isEnabled) return;
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_TELEMETRY_IN_TEST) return;

    try {
      const activeTraceId = traceId || traceContextService.getTraceId();
      const activeSpanId = spanId || traceContextService.getSpanId();
      const now = Date.now();
      const severityNumberMap: Record<string, number> = {
        DEBUG: 5,
        INFO: 9,
        WARN: 13,
        ERROR: 17,
      };

      const logRecord: any = {
        timeUnixNano: String(BigInt(now) * BigInt(1_000_000)),
        observedTimeUnixNano: String(BigInt(now) * BigInt(1_000_000)),
        severityNumber: severityNumberMap[level] || 9,
        severityText: level,
        body: { stringValue: message },
        attributes: Object.entries(attributes).map(([k, v]) => ({
          key: k,
          value:
            typeof v === 'number'
              ? { intValue: v }
              : typeof v === 'boolean'
                ? { boolValue: v }
                : { stringValue: String(v ?? '') },
        })),
      };

      if (activeTraceId) logRecord.traceId = activeTraceId;
      if (activeSpanId) logRecord.spanId = activeSpanId;

      const payload = {
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'codeless-backend' } },
                { key: 'service.environment', value: { stringValue: process.env.NODE_ENV || 'development' } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'codeless-logger', version: '1.0.0' },
                logRecords: [logRecord],
              },
            ],
          },
        ],
      };

      if (typeof fetch === 'function') {
        fetch(this.otlpLogsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    } catch {
      // Non-blocking log dispatch
    }
  }
}

export const telemetry = new TelemetryService();
