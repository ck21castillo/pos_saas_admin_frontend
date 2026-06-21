import adminClient from './adminClient';

export type AuditLogItem = {
  id_audit?: string | number | null;
  actor_id?: string | null;
  actor_email?: string | null;
  action?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  before_json?: string | null;
  after_json?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  created_at?: string | null;
};

export type AuditLogResponse = {
  ok: boolean;
  total: number;
  limit: number;
  offset: number;
  items: AuditLogItem[];
  actions: string[];
  message?: string;
};

export async function listAuditLog(params?: {
  q?: string;
  action?: string;
  target_type?: string;
  id_empresa?: number | string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  const { data } = await adminClient.get('/admin/audit-log', { params });
  return data as AuditLogResponse;
}
