import { request } from './api';
import type { AuditLogItem } from '../types';

export interface AuditStats {
  totalLogs: number;
  errorCount: number;
  fetchCount: number;
  avgDurationMs: number;
}

export interface GetAuditLogsParams {
  page?: number;
  limit?: number;
  search?: string;
  traceId?: string;
  status?: string;
  type?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
}

export interface AuditLogsResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats?: AuditStats;
}

export const auditService = {
  async getAuditLogs(params?: GetAuditLogsParams): Promise<AuditLogsResponse> {
    const sp = new URLSearchParams();
    if (params) {
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      if (params.search) sp.set('search', params.search);
      if (params.traceId) sp.set('traceId', params.traceId);
      if (params.status) sp.set('status', params.status);
      if (params.type) sp.set('type', params.type);
      if (params.action) sp.set('action', params.action);
      if (params.entityType) sp.set('entityType', params.entityType);
      if (params.actorId) sp.set('actorId', params.actorId);
    }
    const qs = sp.toString();
    return request<any>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },
};
