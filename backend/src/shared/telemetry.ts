import { Logger } from '@nestjs/common';

export interface TraceSpan {
  name: string;
  traceId: string;
  spanId: string;
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
  private readonly isEnabled =
    process.env.ENABLE_TELEMETRY === 'true' || Boolean(process.env.SIGNOZ_OTLP_URL);

  startSpan(name: string, attributes: Record<string, any> = {}): TraceSpan {
    const traceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const spanId = Math.random().toString(36).substring(2, 10);
    const startTime = Date.now();

    return {
      name,
      traceId,
      spanId,
      startTime,
      attributes,
      end: (status = 'ok', errorMsg?: string) => {
        const duration = Date.now() - startTime;
        if (errorMsg) {
          attributes['error.message'] = errorMsg;
        }
        attributes['status'] = status;
        attributes['duration_ms'] = duration;

        if (this.isEnabled) {
          this.sendOtlpSpan(name, traceId, spanId, startTime, duration, status, attributes).catch(
            () => {},
          );
        }
      },
    };
  }

  private async sendOtlpSpan(
    name: string,
    traceId: string,
    spanId: string,
    startTime: number,
    durationMs: number,
    status: string,
    attributes: Record<string, any>,
  ) {
    try {
      const payload = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'codeless-backend' } },
              ],
            },
            scopeSpans: [
              {
                scope: { name: 'codeless-tracer' },
                spans: [
                  {
                    traceId,
                    spanId,
                    name,
                    kind: 1,
                    startTimeUnixNano: String(BigInt(startTime) * BigInt(1_000_000)),
                    endTimeUnixNano: String(BigInt(startTime + durationMs) * BigInt(1_000_000)),
                    status: {
                      code: status === 'ok' ? 1 : 2,
                      message: attributes['error.message'],
                    },
                    attributes: Object.entries(attributes).map(([k, v]) => ({
                      key: k,
                      value:
                        typeof v === 'number'
                          ? { intValue: v }
                          : { stringValue: String(v ?? '') },
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };

      if (typeof fetch === 'function') {
        await fetch(this.otlpUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch {
      // Non-blocking telemetry
    }
  }
}

export const telemetry = new TelemetryService();
