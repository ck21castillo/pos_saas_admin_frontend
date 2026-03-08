import adminClient from './adminClient';

export type NotificationScope = 'GLOBAL' | 'EMPRESA' | 'USUARIO';
export type NotificationTipo = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type AdminNotificationItem = {
  id_notification: number;
  scope: NotificationScope;
  id_empresa: number | null;
  empresa_nombre: string | null;
  id_usuario: number | null;
  usuario_email: string | null;
  usuario_nombre?: string | null;
  titulo: string;
  mensaje: string;
  tipo: NotificationTipo;
  meta: unknown;
  starts_at: string | null;
  expires_at: string | null;
  created_by: number | null;
  estado: number;
  created_at: string;
};

export async function listAdminNotifications(params?: {
  scope?: NotificationScope | '';
  estado?: 0 | 1 | '';
  id_empresa?: number;
  q?: string;
  limit?: number;
  offset?: number;
}) {
  const { data } = await adminClient.get('/admin/notifications', { params });
  return (data?.items ?? []) as AdminNotificationItem[];
}

export async function createAdminNotification(payload: {
  scope: NotificationScope;
  id_empresa?: number;
  id_usuario?: number;
  titulo: string;
  mensaje: string;
  tipo?: NotificationTipo;
  starts_at?: string;
  expires_at?: string;
  meta?: unknown;
}) {
  const { data } = await adminClient.post('/admin/notifications', payload);
  return data as { ok: boolean; id_notification: number };
}

export async function setAdminNotificationEstado(id: number, estado: 0 | 1) {
  const { data } = await adminClient.patch(`/admin/notifications/${id}/estado`, { estado });
  return data as { ok: boolean; id_notification: number; estado: 0 | 1 };
}

export async function updateAdminNotification(
  id: number,
  payload: {
    titulo?: string;
    mensaje?: string;
    tipo?: NotificationTipo;
    starts_at?: string | null;
    expires_at?: string | null;
  }
) {
  const { data } = await adminClient.patch(`/admin/notifications/${id}`, payload);
  return data as { ok: boolean; id_notification: number };
}
