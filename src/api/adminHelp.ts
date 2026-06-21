import adminClient from './adminClient';

export type HelpTicketEstado = 'ABIERTO' | 'EN_PROCESO' | 'RESPONDIDO' | 'CERRADO';
export type HelpTicketPrioridad = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE';

export type HelpAdminUser = {
  id_superadmin: number;
  email: string;
};

export type HelpTicketListItem = {
  id_ticket: number;
  id_empresa: number;
  empresa_nombre: string | null;
  id_usuario: number | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  asunto: string;
  estado: HelpTicketEstado;
  prioridad: HelpTicketPrioridad;
  origen: string;
  assigned_to: number | null;
  assigned_to_email: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type HelpTicketListResponse = {
  items: HelpTicketListItem[];
  total: number;
  limit: number;
  offset: number;
  assignment_enabled: boolean;
};

export type HelpTicketMessage = {
  id_message: number;
  actor_tipo: 'CLIENTE' | 'ADMIN' | string;
  actor_id: number | null;
  mensaje: string;
  created_at: string;
};

export type HelpTicketDetail = {
  id_ticket: number;
  id_empresa: number;
  empresa_nombre?: string | null;
  id_usuario: number | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  asunto: string;
  estado: HelpTicketEstado;
  prioridad: HelpTicketPrioridad;
  origen: string;
  assigned_to: number | null;
  assigned_to_email: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export async function listHelpTickets(params?: {
  estado?: HelpTicketEstado | '';
  prioridad?: HelpTicketPrioridad | '';
  q?: string;
  id_empresa?: number;
  assigned_to?: number | 'none' | '';
  fecha_desde?: string;
  fecha_hasta?: string;
  limit?: number;
  offset?: number;
}): Promise<HelpTicketListResponse> {
  const { data } = await adminClient.get('/admin/help/tickets', { params });
  return {
    items: (data?.items ?? []) as HelpTicketListItem[],
    total: Number(data?.total ?? 0),
    limit: Number(data?.limit ?? params?.limit ?? 25),
    offset: Number(data?.offset ?? params?.offset ?? 0),
    assignment_enabled: Boolean(data?.assignment_enabled ?? false),
  };
}

export async function listHelpAdmins(): Promise<HelpAdminUser[]> {
  const { data } = await adminClient.get('/admin/help/admins');
  return (data?.items ?? []) as HelpAdminUser[];
}

export async function getHelpTicket(id: number) {
  const { data } = await adminClient.get(`/admin/help/tickets/${id}`);
  return {
    ticket: data?.ticket as HelpTicketDetail,
    messages: (data?.messages ?? []) as HelpTicketMessage[],
    assignment_enabled: Boolean(data?.assignment_enabled ?? false),
  };
}

export async function replyHelpTicket(id: number, mensaje: string) {
  const { data } = await adminClient.post(`/admin/help/tickets/${id}/messages`, { mensaje });
  return data as { ok: boolean };
}

export async function updateHelpTicketEstado(id: number, estado: HelpTicketEstado) {
  const { data } = await adminClient.patch(`/admin/help/tickets/${id}/estado`, { estado });
  return data as { ok: boolean; estado: HelpTicketEstado };
}

export async function updateHelpTicketPrioridad(id: number, prioridad: HelpTicketPrioridad) {
  const { data } = await adminClient.patch(`/admin/help/tickets/${id}/prioridad`, { prioridad });
  return data as { ok: boolean; prioridad: HelpTicketPrioridad };
}

export async function updateHelpTicketAsignacion(id: number, assignedTo: number | null) {
  const { data } = await adminClient.patch(`/admin/help/tickets/${id}/asignacion`, { assigned_to: assignedTo });
  return data as { ok: boolean; assigned_to: number | null };
}
