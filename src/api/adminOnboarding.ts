import adminClient from './adminClient';
import type { AxiosRequestConfig } from 'axios';

export type InvitationRequestEstado = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
export type InvitationEmailTemplate = 'cliente' | 'meta';

export type InvitationRequestRow = {
  id_request: number;
  email: string;
  empresa_nombre: string | null;
  telefono: string | null;
  plan_solicitado: string | null;
  mensaje: string | null;
  estado: InvitationRequestEstado;
  created_at: string;
  ip: string | null;
  user_agent: string | null;
  notas: string | null;
};

type InvitationRequestApiRow = InvitationRequestRow & {
  message?: string | null;
  mensaje_adicional?: string | null;
  additional_message?: string | null;
  comentario?: string | null;
  comentarios?: string | null;
  observaciones?: string | null;
};

export type InvitationRow = {
  id_invitation: number;
  email: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  estado: number;
  used_by_company_id: number | null;
  used_by_user_id: number | null;
};

export type InvitationRequestListResponse = {
  rows: InvitationRequestRow[];
  total: number;
  limit: number;
  offset: number;
};

export type InvitationListResponse = {
  rows: InvitationRow[];
  total: number;
  limit: number;
  offset: number;
};

function firstText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return null;
}

function normalizeInvitationRequestRow(row: InvitationRequestApiRow): InvitationRequestRow {
  return {
    ...row,
    mensaje: firstText(
      row.mensaje,
      row.message,
      row.mensaje_adicional,
      row.additional_message,
      row.comentario,
      row.comentarios,
      row.observaciones
    ),
  };
}

export async function listInvitationRequests(
  estado: InvitationRequestEstado = 'PENDIENTE',
  params?: { limit?: number; offset?: number },
  config?: Pick<AxiosRequestConfig, 'signal'>
): Promise<InvitationRequestListResponse> {
  const { data } = await adminClient.get('/onboarding/requests', {
    ...config,
    params: { estado, limit: params?.limit, offset: params?.offset },
  });
  return {
    rows: ((data?.rows ?? []) as InvitationRequestApiRow[]).map(normalizeInvitationRequestRow),
    total: Number(data?.total ?? 0),
    limit: Number(data?.limit ?? params?.limit ?? 25),
    offset: Number(data?.offset ?? params?.offset ?? 0),
  };
}

export async function updateInvitationRequest(
  id: number,
  payload: { estado: InvitationRequestEstado; notas?: string }
) {
  const { data } = await adminClient.patch(`/onboarding/requests/${id}`, payload);
  return data;
}

export async function createInvitation(payload: { email: string; days?: number; email_template?: InvitationEmailTemplate }) {
  const { data } = await adminClient.post('/onboarding/invitations', payload);
  return data as {
    ok: boolean;
    id_invitation: number;
    expires_at: string;
    invite_code: string;
    email: string;
    email_template: InvitationEmailTemplate;
    email_sent: boolean;
    email_error: string | null;
  };
}

export async function listInvitations(
  email?: string,
  params?: { limit?: number; offset?: number },
  config?: Pick<AxiosRequestConfig, 'signal'>
): Promise<InvitationListResponse> {
  const { data } = await adminClient.get('/onboarding/invitations', {
    ...config,
    params: {
      ...(email ? { email } : {}),
      limit: params?.limit,
      offset: params?.offset,
    },
  });
  return {
    rows: (data?.rows ?? []) as InvitationRow[],
    total: Number(data?.total ?? 0),
    limit: Number(data?.limit ?? params?.limit ?? 25),
    offset: Number(data?.offset ?? params?.offset ?? 0),
  };
}