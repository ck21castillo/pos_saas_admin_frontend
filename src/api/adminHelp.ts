import adminClient from './adminClient';

export type HelpTicketEstado = 'ABIERTO' | 'EN_PROCESO' | 'RESPONDIDO' | 'CERRADO';

export type HelpTicketListItem = {
  id_ticket: number;
  id_empresa: number;
  empresa_nombre: string | null;
  id_usuario: number | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  asunto: string;
  estado: HelpTicketEstado;
  prioridad: string;
  origen: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
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
  prioridad: string;
  origen: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export async function listHelpTickets(params?: {
  estado?: HelpTicketEstado | '';
  q?: string;
  id_empresa?: number;
  limit?: number;
  offset?: number;
}) {
  const { data } = await adminClient.get('/admin/help/tickets', { params });
  return (data?.items ?? []) as HelpTicketListItem[];
}

export async function getHelpTicket(id: number) {
  const { data } = await adminClient.get(`/admin/help/tickets/${id}`);
  return {
    ticket: data?.ticket as HelpTicketDetail,
    messages: (data?.messages ?? []) as HelpTicketMessage[],
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
