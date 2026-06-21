import adminClient from './adminClient';

export type DashboardKpis = {
  empresas_activas: number;
  empresas_inactivas: number;
  solicitudes_pendientes: number;
  tickets_abiertos: number;
  tenants_advertencia: number;
  visitas_hoy: number;
  visitas_7d: number;
};

export type DashboardPendingRequest = {
  id_request: number;
  email: string;
  empresa_nombre: string | null;
  telefono: string | null;
  plan_solicitado: string | null;
  created_at: string | null;
};

export type DashboardOpenTicket = {
  id_ticket: number;
  id_empresa: number | null;
  empresa_nombre: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  asunto: string | null;
  estado: string | null;
  prioridad: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DashboardTenantWarning = {
  id_empresa: number;
  empresa_nombre: string | null;
  db_name: string | null;
  estado: string | null;
  motivo: string | null;
  updated_at: string | null;
};

export type DashboardRecentVisit = {
  id_visit: number;
  visitor_id: string;
  landing_path: string;
  referrer: string | null;
  page_location: string | null;
  created_at: string | null;
};

export type AdminDashboardResponse = {
  ok: boolean;
  kpis: DashboardKpis;
  pending_requests: DashboardPendingRequest[];
  open_tickets: DashboardOpenTicket[];
  tenant_warnings: DashboardTenantWarning[];
  recent_visits: DashboardRecentVisit[];
  updated_at: string;
};

export async function getAdminDashboard(): Promise<AdminDashboardResponse> {
  const { data } = await adminClient.get<AdminDashboardResponse>('/admin/dashboard');
  return data;
}
