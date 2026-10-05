import adminClient from './adminClient';

export type TenantHealthStatus = 'PENDING' | 'OK' | 'WARNING' | 'ERROR';
export type TenantInspectionState = 'PENDING' | 'FRESH' | 'STALE';
export type TenantInspectionSource = 'NOT_CHECKED' | 'SNAPSHOT' | 'DIRECT' | string;

export type TenantInfo = {
  modo?: string | null;
  db_host?: string | null;
  db_port?: string | number | null;
  db_name?: string | null;
  db_schema?: string | null;
  db_user?: string | null;
  estado?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TenantHealthItem = {
  id_empresa: number;
  empresa_nombre: string;
  empresa_codigo?: string | null;
  empresa_estado: number;
  tipo_negocio?: string | null;
  tenant: TenantInfo;
  health_status: TenantHealthStatus;
  inspection?: {
    state: TenantInspectionState;
    source: TenantInspectionSource;
    checked_at?: string | null;
    ttl_seconds?: number | null;
    deep?: boolean | number | null;
    persisted?: boolean | null;
  } | null;
  connection_ms?: number | null;
  check_ms?: number | null;
  db_size_bytes: number;
  db_size: string;
  counts: Record<string, number>;
  recent: Record<string, number>;
  top_tables?: Array<{
    table: string;
    live_rows: number;
    dead_rows: number;
    total_bytes: number;
    total_size: string;
  }>;
  warnings: string[];
  errors: string[];
  checked_at?: string | null;
};

export type TenantHealthListResponse = {
  ok: boolean;
  snapshot_supported?: boolean;
  snapshot_ttl_seconds?: number;
  total: number;
  limit: number;
  offset: number;
  q: string;
  summary: { ok: number; warning: number; error: number; pending?: number };
  items: TenantHealthItem[];
};

export async function listTenantHealth(params?: { q?: string; limit?: number; offset?: number }) {
  const { data } = await adminClient.get('/admin/tenant-health', { params });
  return data as TenantHealthListResponse;
}

export async function getTenantHealth(idEmpresa: number, deep = false) {
  const { data } = await adminClient.get(`/admin/tenant-health/${idEmpresa}`, {
    params: { deep: deep ? 1 : 0 },
  });
  return data as { ok: boolean; item: TenantHealthItem };
}
