import { getAuthHeader } from '@/helper/helper';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface AuditLogEntry {
  _id: string;
  userId: string;
  action: string;
  method: string;
  path: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  statusCode: number | null;
  createdAt: string;
}

export interface AuditSummaryBreakdown {
  _id: string;
  count: number;
  lastAt: string;
}

export interface AuditSummary {
  totalActions: number;
  lastActivity: string | null;
  lastAction: string | null;
  breakdown: AuditSummaryBreakdown[];
}

export const auditLogService = {
  async getUserLogs(userId: string, page = 1, limit = 50, action?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (action) params.set('action', action);

    const res = await fetch(`${API}/admin/audit-logs/user/${userId}?${params}`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json() as Promise<{
      data: AuditLogEntry[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
    }>;
  },

  async getUserSummary(userId: string) {
    const res = await fetch(`${API}/admin/audit-logs/user/${userId}/summary`, {
      headers: getAuthHeader(),
    });
    if (!res.ok) throw new Error('Failed to fetch audit summary');
    return res.json() as Promise<{ data: AuditSummary }>;
  },
};
