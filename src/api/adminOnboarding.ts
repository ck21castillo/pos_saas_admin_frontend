import adminClient from './adminClient';

export type InvitationRequestEstado = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export type InvitationRequestRow = {
  id_request: number;
  email: string;
  empresa_nombre: string | null;
  estado: InvitationRequestEstado;
  created_at: string;
  ip: string | null;
  user_agent: string | null;
  notas: string | null;
};

export type InvitationRow = {
  id_invitation: number;
  email: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  estado: number; // 1=activa
  used_by_company_id: number | null;
  used_by_user_id: number | null;
};

export async function listInvitationRequests(estado: InvitationRequestEstado = 'PENDIENTE') {
  const { data } = await adminClient.get('/onboarding/requests', { params: { estado } });
  return (data?.rows ?? []) as InvitationRequestRow[];
}

export async function updateInvitationRequest(
  id: number,
  payload: { estado: InvitationRequestEstado; notas?: string }
) {
  const { data } = await adminClient.patch(`/onboarding/requests/${id}`, payload);
  return data;
}

export async function createInvitation(payload: { email: string; days?: number }) {
  const { data } = await adminClient.post('/onboarding/invitations', payload);
  return data as {
    ok: boolean;
    id_invitation: number;
    expires_at: string;
    invite_code: string;
    email: string;
  };
}

export async function listInvitations(email?: string) {
  const { data } = await adminClient.get('/onboarding/invitations', {
    params: email ? { email } : undefined,
  });
  return (data?.rows ?? []) as InvitationRow[];
}
