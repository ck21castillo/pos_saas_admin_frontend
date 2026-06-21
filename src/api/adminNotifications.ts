import adminClient from './adminClient';

export type NotificationScope = 'GLOBAL' | 'EMPRESA' | 'USUARIO';
export type NotificationTipo = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type NotificationSituacion = 'VIGENTE' | 'PROGRAMADA' | 'EXPIRADA' | 'INACTIVA' | 'ARCHIVADA';

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
  archived_at: string | null;
  archived_by: number | null;
  estado_operativo: NotificationSituacion;
  read_count: number;
  last_read_at: string | null;
  target_label: string | null;
  created_by: number | null;
  estado: number;
  created_at: string;
};

export type AdminNotificationListResponse = {
  items: AdminNotificationItem[];
  total: number;
  limit: number;
  offset: number;
  archive_enabled: boolean;
};

export type AdminNotificationReadItem = {
  id_empresa: number;
  empresa_nombre: string | null;
  id_usuario: number;
  usuario_email: string | null;
  usuario_nombre: string | null;
  read_at: string;
};

export type AdminNotificationReadsResponse = {
  notification: AdminNotificationItem;
  reads: AdminNotificationReadItem[];
  read_count: number;
  limit: number;
};

export async function listAdminNotifications(params?: {
  scope?: NotificationScope | '';
  estado?: 0 | 1 | '';
  situacion?: NotificationSituacion | '';
  id_empresa?: number;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminNotificationListResponse> {
  const { data } = await adminClient.get('/admin/notifications', { params });
  return {
    items: (data?.items ?? []) as AdminNotificationItem[],
    total: Number(data?.total ?? 0),
    limit: Number(data?.limit ?? params?.limit ?? 25),
    offset: Number(data?.offset ?? params?.offset ?? 0),
    archive_enabled: Boolean(data?.archive_enabled ?? false),
  };
}

export async function getAdminNotificationReads(id: number): Promise<AdminNotificationReadsResponse> {
  const { data } = await adminClient.get(`/admin/notifications/${id}/reads`);
  return {
    notification: data?.notification as AdminNotificationItem,
    reads: (data?.reads ?? []) as AdminNotificationReadItem[],
    read_count: Number(data?.read_count ?? 0),
    limit: Number(data?.limit ?? 100),
  };
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

export async function archiveAdminNotification(id: number, archived: boolean) {
  const { data } = await adminClient.patch(`/admin/notifications/${id}/archive`, { archived });
  return data as { ok: boolean; id_notification: number; archived: boolean };
}

export async function archiveExpiredAdminNotifications() {
  const { data } = await adminClient.post('/admin/notifications/archive-expired');
  return data as { ok: boolean; archived: number };
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
