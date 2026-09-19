import { request } from './api';
import type { AuditLogItem } from '../types';

export const auditService = {
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    actorId?: string;
  }): Promise<{ items: AuditLogItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const sp = new URLSearchParams();
    if (params) {
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      if (params.action) sp.set('action', params.action);
      if (params.entityType) sp.set('entityType', params.entityType);
      if (params.actorId) sp.set('actorId', params.actorId);
    }
    const qs = sp.toString();
    return request<any>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
  },
};
