import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import { getEmpresaUsuarioAdmin, listEmpresas, type Empresa } from '../../api/adminEmpresas';
import {
  archiveAdminNotification,
  archiveExpiredAdminNotifications,
  createAdminNotification,
  getAdminNotificationReads,
  listAdminNotifications,
  setAdminNotificationEstado,
  updateAdminNotification,
  type AdminNotificationItem,
  type NotificationScope,
  type NotificationSituacion,
  type NotificationTipo,
} from '../../api/adminNotifications';

type ApiErrorLike = { message?: string; response?: { data?: { error?: string; message?: string } } };
type NotificationFilters = {
  scope: NotificationScope | '';
  estado: 0 | 1 | '';
  situacion: NotificationSituacion | '';
  empresa: string;
  query: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' });

function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as ApiErrorLike;
  return e.response?.data?.error ?? e.response?.data?.message ?? e.message ?? fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseScopeFilter(value: string): NotificationScope | '' {
  return value === '' || value === 'GLOBAL' || value === 'EMPRESA' || value === 'USUARIO' ? value : '';
}

function parseEstadoFilter(value: string): 0 | 1 | '' {
  if (value === '') return '';
  return value === '1' ? 1 : value === '0' ? 0 : '';
}

function parseSituacionFilter(value: string): NotificationSituacion | '' {
  return value === '' ||
    value === 'VIGENTE' ||
    value === 'PROGRAMADA' ||
    value === 'EXPIRADA' ||
    value === 'INACTIVA' ||
    value === 'ARCHIVADA'
    ? value
    : '';
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : dateTimeFormatter.format(d);
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16).replace(' ', 'T');
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fullName(nombre?: string | null, apellido?: string | null) {
  return `${nombre ?? ''} ${apellido ?? ''}`.trim();
}

function situacionBadgeClass(value: NotificationSituacion) {
  if (value === 'VIGENTE') return 'badge bg-success';
  if (value === 'PROGRAMADA') return 'badge bg-info text-dark';
  if (value === 'EXPIRADA') return 'badge bg-warning text-dark';
  if (value === 'ARCHIVADA') return 'badge bg-dark';
  return 'badge bg-secondary';
}

function tipoBadgeClass(value: NotificationTipo) {
  if (value === 'SUCCESS') return 'badge bg-success';
  if (value === 'WARNING') return 'badge bg-warning text-dark';
  if (value === 'ERROR') return 'badge bg-danger';
  return 'badge bg-primary';
}

function scopeLabel(scope: NotificationScope) {
  if (scope === 'GLOBAL') return 'Global';
  if (scope === 'EMPRESA') return 'Empresa';
  return 'Usuario';
}

const NotificationsPage: React.FC = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [scope, setScope] = useState<NotificationScope>('GLOBAL');
  const [idEmpresa, setIdEmpresa] = useState('');
  const [adminDestino, setAdminDestino] = useState<{ id_usuario: number; nombre: string; email: string } | null>(null);
  const [loadingAdminDestino, setLoadingAdminDestino] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState<NotificationTipo>('INFO');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [fScope, setFScope] = useState<NotificationScope | ''>('');
  const [fEstado, setFEstado] = useState<0 | 1 | ''>('');
  const [fSituacion, setFSituacion] = useState<NotificationSituacion | ''>('');
  const [fEmpresa, setFEmpresa] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [archiveEnabled, setArchiveEnabled] = useState(false);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  const loadWithFilters = async (
    nextOffset = offset,
    nextLimit = limit,
    filters: NotificationFilters = { scope: fScope, estado: fEstado, situacion: fSituacion, empresa: fEmpresa, query: q }
  ) => {
    setLoading(true);
    try {
      const response = await listAdminNotifications({
        scope: filters.scope,
        estado: filters.estado,
        situacion: filters.situacion,
        id_empresa: filters.empresa.trim() ? Number(filters.empresa) : undefined,
        q: filters.query.trim() || undefined,
        limit: nextLimit,
        offset: nextOffset,
      });
      setItems(response.items);
      setTotal(response.total);
      setLimit(response.limit);
      setOffset(response.offset);
      setArchiveEnabled(response.archive_enabled);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo cargar notificaciones'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const load = async () => {
    await loadWithFilters(offset, limit);
  };

  const loadEmpresas = async () => {
    const out = await listEmpresas({ limit: 200, offset: 0 });
    setEmpresas(out.items);
  };

  const loadAdminDestino = async (empresaId: number) => {
    setLoadingAdminDestino(true);
    try {
      const out = await getEmpresaUsuarioAdmin(empresaId);
      setAdminDestino({
        id_usuario: out.item.id_usuario,
        nombre: fullName(out.item.nombre, out.item.apellido) || '(Sin nombre)',
        email: out.item.email,
      });
    } catch (error: unknown) {
      setAdminDestino(null);
      Swal.fire('Aviso', getErrorMessage(error, 'No se encontro administrador activo para esta empresa'), 'info');
    } finally {
      setLoadingAdminDestino(false);
    }
  };

  useEffect(() => {
    void loadEmpresas();
    void loadWithFilters(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scope !== 'USUARIO') {
      setAdminDestino(null);
      return;
    }
    const empresa = Number(idEmpresa);
    if (!empresa) {
      setAdminDestino(null);
      return;
    }
    void loadAdminDestino(empresa);
  }, [scope, idEmpresa]);

  const canCreate = useMemo(() => {
    if (!titulo.trim() || !mensaje.trim()) return false;
    if (scope === 'EMPRESA' && !idEmpresa.trim()) return false;
    if (scope === 'USUARIO' && (!idEmpresa.trim() || !adminDestino?.id_usuario)) return false;
    return true;
  }, [scope, idEmpresa, adminDestino, titulo, mensaje]);

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const currentPage = Math.floor(offset / Math.max(1, limit)) + 1;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + items.length, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;
  const currentFilters = (): NotificationFilters => ({ scope: fScope, estado: fEstado, situacion: fSituacion, empresa: fEmpresa, query: q });

  const previewHtml = () => {
    const alcance =
      scope === 'GLOBAL'
        ? 'Todas las empresas'
        : scope === 'EMPRESA'
          ? empresas.find((e) => String(e.id_empresa) === idEmpresa)?.nombre || `Empresa ${idEmpresa}`
          : adminDestino
            ? `${adminDestino.nombre} (${adminDestino.email})`
            : 'Usuario administrador';
    return `
      <div style="text-align:left">
        <div style="border:1px solid #dce5f3;border-radius:8px;padding:12px;margin-bottom:12px;background:#f8fbff">
          <div style="font-size:12px;color:#65748b;margin-bottom:6px">${escapeHtml(scopeLabel(scope))} - ${escapeHtml(tipo)}</div>
          <div style="font-weight:700;font-size:18px;margin-bottom:6px">${escapeHtml(titulo.trim())}</div>
          <div style="white-space:pre-wrap;color:#334155">${escapeHtml(mensaje.trim())}</div>
        </div>
        <p style="margin:0 0 4px"><strong>Alcance:</strong> ${escapeHtml(alcance)}</p>
        <p style="margin:0 0 4px"><strong>Inicio:</strong> ${escapeHtml(startsAt || 'Inmediata')}</p>
        <p style="margin:0"><strong>Vence:</strong> ${escapeHtml(expiresAt || 'Sin vencimiento')}</p>
      </div>
    `;
  };

  const onCreate = async () => {
    if (!canCreate) {
      Swal.fire('Campos requeridos', 'Completa los campos obligatorios segun el alcance.', 'info');
      return;
    }
    const preview = await Swal.fire({
      title: 'Vista previa',
      html: previewHtml(),
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Enviar notificacion',
      cancelButtonText: 'Volver a editar',
      width: 640,
    });
    if (!preview.isConfirmed) return;
    setCreating(true);
    try {
      const payload: Parameters<typeof createAdminNotification>[0] = {
        scope,
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
        tipo,
        starts_at: startsAt || undefined,
        expires_at: expiresAt || undefined,
      };
      if (scope !== 'GLOBAL') payload.id_empresa = Number(idEmpresa);
      if (scope === 'USUARIO' && adminDestino?.id_usuario) payload.id_usuario = adminDestino.id_usuario;
      const out = await createAdminNotification(payload);
      await Swal.fire('Creada', `Notificacion #${out.id_notification}`, 'success');
      setTitulo('');
      setMensaje('');
      setStartsAt('');
      setExpiresAt('');
      if (scope === 'GLOBAL') setIdEmpresa('');
      await loadWithFilters(0, limit);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo crear notificacion'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const onShowReads = async (n: AdminNotificationItem) => {
    try {
      const out = await getAdminNotificationReads(n.id_notification);
      const rows =
        out.reads.length === 0
          ? '<div style="color:#65748b">Sin lecturas registradas.</div>'
          : out.reads
              .map(
                (r) => `
            <tr>
              <td style="padding:6px;border-bottom:1px solid #e5e7eb">${escapeHtml(r.empresa_nombre || String(r.id_empresa))}</td>
              <td style="padding:6px;border-bottom:1px solid #e5e7eb">${escapeHtml(r.usuario_nombre || r.usuario_email || String(r.id_usuario))}</td>
              <td style="padding:6px;border-bottom:1px solid #e5e7eb;white-space:nowrap">${escapeHtml(fmtDate(r.read_at))}</td>
            </tr>`
              )
              .join('');
      await Swal.fire({
        title: `Alcance y lecturas #${n.id_notification}`,
        html: `
          <div style="text-align:left">
            <p><strong>Alcance:</strong> ${escapeHtml(n.target_label || scopeLabel(n.scope))}</p>
            <p><strong>Lecturas:</strong> ${out.read_count}</p>
            <div style="max-height:320px;overflow:auto">
              ${
                out.reads.length === 0
                  ? rows
                  : `<table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:6px">Empresa</th><th style="text-align:left;padding:6px">Usuario</th><th style="text-align:left;padding:6px">Leida</th></tr></thead><tbody>${rows}</tbody></table>`
              }
            </div>
          </div>`,
        width: 780,
        confirmButtonText: 'Cerrar',
      });
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo cargar el detalle de lecturas'), 'error');
    }
  };

  const onEdit = async (n: AdminNotificationItem) => {
    const { isConfirmed, value } = await Swal.fire({
      title: `Editar #${n.id_notification}`,
      html: `
        <div style="text-align:left">
          <label style="display:block;margin-bottom:6px;">Titulo</label>
          <input id="swal-titulo" class="swal2-input" maxlength="180" value="${escapeHtml(n.titulo || '')}" style="width:100%;margin:0 0 12px 0;" />
          <label style="display:block;margin-bottom:6px;">Mensaje</label>
          <textarea id="swal-mensaje" class="swal2-textarea" rows="5" style="width:100%;margin:0 0 12px 0;resize:vertical;">${escapeHtml(n.mensaje || '')}</textarea>
          <label style="display:block;margin-bottom:6px;">Tipo</label>
          <select id="swal-tipo" class="swal2-select" style="width:100%;margin:0 0 12px 0;">
            <option value="INFO" ${n.tipo === 'INFO' ? 'selected' : ''}>INFORMATIVO</option>
            <option value="SUCCESS" ${n.tipo === 'SUCCESS' ? 'selected' : ''}>EXITO</option>
            <option value="WARNING" ${n.tipo === 'WARNING' ? 'selected' : ''}>ADVERTENCIA</option>
            <option value="ERROR" ${n.tipo === 'ERROR' ? 'selected' : ''}>ERROR</option>
          </select>
          <label style="display:block;margin-bottom:6px;">Inicia</label>
          <input id="swal-starts" class="swal2-input" type="datetime-local" value="${escapeHtml(toDatetimeLocal(n.starts_at))}" style="width:100%;margin:0 0 12px 0;" />
          <label style="display:block;margin-bottom:6px;">Vence</label>
          <input id="swal-expires" class="swal2-input" type="datetime-local" value="${escapeHtml(toDatetimeLocal(n.expires_at))}" style="width:100%;margin:0;" />
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'Guardar cambios',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        const tituloEl = document.getElementById('swal-titulo') as HTMLInputElement | null;
        const mensajeEl = document.getElementById('swal-mensaje') as HTMLTextAreaElement | null;
        const tipoEl = document.getElementById('swal-tipo') as HTMLSelectElement | null;
        const startsEl = document.getElementById('swal-starts') as HTMLInputElement | null;
        const expiresEl = document.getElementById('swal-expires') as HTMLInputElement | null;
        const tituloVal = (tituloEl?.value ?? '').trim();
        const mensajeVal = (mensajeEl?.value ?? '').trim();
        if (!tituloVal || !mensajeVal) {
          Swal.showValidationMessage('Titulo y mensaje son obligatorios.');
          return;
        }
        return {
          titulo: tituloVal,
          mensaje: mensajeVal,
          tipo: (tipoEl?.value ?? 'INFO') as NotificationTipo,
          starts_at: (startsEl?.value ?? '').trim(),
          expires_at: (expiresEl?.value ?? '').trim(),
        };
      },
    });
    if (!isConfirmed || !value) return;
    try {
      await updateAdminNotification(n.id_notification, value);
      await Swal.fire('Actualizada', `Notificacion #${n.id_notification} actualizada`, 'success');
      await load();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo actualizar notificacion'), 'error');
    }
  };

  const onToggleEstado = async (n: AdminNotificationItem) => {
    const next = n.estado === 1 ? 0 : 1;
    const verbo = next === 1 ? 'activar' : 'desactivar';
    const ok = await Swal.fire({
      title: `${verbo[0].toUpperCase()}${verbo.slice(1)} notificacion`,
      text: `#${n.id_notification} - ${n.titulo}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, confirmar',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;
    try {
      await setAdminNotificationEstado(n.id_notification, next as 0 | 1);
      await load();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo actualizar estado'), 'error');
    }
  };

  const onArchive = async (n: AdminNotificationItem, archived: boolean) => {
    if (!archiveEnabled) {
      Swal.fire('SQL pendiente', 'Ejecuta el SQL manual de archivado de notificaciones en bersano_control.', 'info');
      return;
    }
    const ok = await Swal.fire({
      title: archived ? 'Archivar notificacion' : 'Restaurar notificacion',
      text: `#${n.id_notification} - ${n.titulo}`,
      icon: archived ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: archived ? 'Si, archivar' : 'Si, restaurar',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;
    try {
      await archiveAdminNotification(n.id_notification, archived);
      await load();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo actualizar archivado'), 'error');
    }
  };

  const onArchiveExpired = async () => {
    if (!archiveEnabled) {
      Swal.fire('SQL pendiente', 'Ejecuta el SQL manual de archivado de notificaciones en bersano_control.', 'info');
      return;
    }
    const ok = await Swal.fire({
      title: 'Archivar expiradas',
      text: 'Se archivaran las notificaciones vencidas para limpiar la vista operativa. No se borraran datos.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Archivar expiradas',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;
    try {
      const out = await archiveExpiredAdminNotifications();
      await Swal.fire('Listo', `Archivadas: ${out.archived}`, 'success');
      await loadWithFilters(0, limit);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudieron archivar expiradas'), 'error');
    }
  };

  const onScopeChipClick = (nextScope: NotificationScope | '') => {
    setFScope(nextScope);
    void loadWithFilters(0, limit, { ...currentFilters(), scope: nextScope });
  };
  const onFilter = () => void loadWithFilters(0, limit);
  const onClear = () => {
    const emptyFilters: NotificationFilters = { scope: '', estado: '', situacion: '', empresa: '', query: '' };
    setFScope('');
    setFEstado('');
    setFSituacion('');
    setFEmpresa('');
    setQ('');
    void loadWithFilters(0, limit, emptyFilters);
  };
  const onLimitChange = (value: number) => void loadWithFilters(0, value);

  return (
    <PageLayout title="Notificaciones">
      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">Nueva notificacion</h5>
              <div className="mb-2">
                <label className="form-label">Categoria / alcance</label>
                <select className="form-select" value={scope} onChange={(e) => setScope(e.target.value as NotificationScope)}>
                  <option value="GLOBAL">Global (todos los clientes)</option>
                  <option value="EMPRESA">Empresa</option>
                  <option value="USUARIO">Usuario (administrador de empresa)</option>
                </select>
              </div>
              {(scope === 'EMPRESA' || scope === 'USUARIO') && (
                <div className="mb-2">
                  <label className="form-label">Empresa</label>
                  <select className="form-select" value={idEmpresa} onChange={(e) => setIdEmpresa(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {empresas.map((e) => <option key={e.id_empresa} value={String(e.id_empresa)}>{e.id_empresa} - {e.nombre}</option>)}
                  </select>
                </div>
              )}
              {scope === 'USUARIO' && (
                <div className="mb-2">
                  <label className="form-label">Usuario destino</label>
                  <div className="form-control bg-light" style={{ minHeight: 42 }}>
                    {loadingAdminDestino ? 'Buscando administrador...' : adminDestino ? `${adminDestino.nombre} (${adminDestino.email})` : 'Selecciona una empresa para cargar su administrador'}
                  </div>
                  <small className="text-muted">Se usa automaticamente el usuario administrador activo de la empresa elegida.</small>
                </div>
              )}
              <div className="mb-2">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value as NotificationTipo)}>
                  <option value="INFO">INFORMATIVO</option>
                  <option value="SUCCESS">EXITO</option>
                  <option value="WARNING">ADVERTENCIA</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label">Titulo</label>
                <input className="form-control" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={180} />
              </div>
              <div className="mb-2">
                <label className="form-label">Mensaje</label>
                <textarea className="form-control" rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
              </div>
              <div className="row g-2 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Inicia</label>
                  <input className="form-control" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Vence</label>
                  <input className="form-control" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary w-100" disabled={creating || !canCreate} onClick={onCreate} type="button">
                {creating ? 'Creando...' : 'Previsualizar y crear'}
              </button>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-7">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3 gap-2 flex-wrap">
                <div>
                  <h5 className="card-title mb-0">Historico</h5>
                  <div className="small text-muted">Total: {total}</div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-warning btn-sm" onClick={onArchiveExpired} type="button">Archivar expiradas</button>
                  <button className="btn btn-outline-secondary btn-sm" onClick={load} type="button">Recargar</button>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className={`btn btn-sm ${fScope === '' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => onScopeChipClick('')}>Todas</button>
                <button type="button" className={`btn btn-sm ${fScope === 'GLOBAL' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => onScopeChipClick('GLOBAL')}>Globales</button>
                <button type="button" className={`btn btn-sm ${fScope === 'EMPRESA' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => onScopeChipClick('EMPRESA')}>Empresa</button>
                <button type="button" className={`btn btn-sm ${fScope === 'USUARIO' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => onScopeChipClick('USUARIO')}>Usuario</button>
              </div>
              <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); onFilter(); }}>
                <div className="col-12 col-md-3">
                  <label className="form-label small mb-1">Alcance</label>
                  <select className="form-select form-select-sm" value={fScope} onChange={(e) => setFScope(parseScopeFilter(e.target.value))}>
                    <option value="">Todos</option>
                    <option value="GLOBAL">GLOBAL</option>
                    <option value="EMPRESA">EMPRESA</option>
                    <option value="USUARIO">USUARIO</option>
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small mb-1">Situacion</label>
                  <select className="form-select form-select-sm" value={fSituacion} onChange={(e) => setFSituacion(parseSituacionFilter(e.target.value))}>
                    <option value="">Operativas</option>
                    <option value="VIGENTE">Vigentes</option>
                    <option value="PROGRAMADA">Programadas</option>
                    <option value="EXPIRADA">Expiradas</option>
                    <option value="INACTIVA">Inactivas</option>
                    <option value="ARCHIVADA">Archivadas</option>
                  </select>
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small mb-1">Estado</label>
                  <select className="form-select form-select-sm" value={fEstado} onChange={(e) => setFEstado(parseEstadoFilter(e.target.value))}>
                    <option value="">Todos</option>
                    <option value="1">Activas</option>
                    <option value="0">Inactivas</option>
                  </select>
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small mb-1">Mostrar</label>
                  <select className="form-select form-select-sm" value={limit} onChange={(e) => onLimitChange(Number(e.target.value))}>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small mb-1">Empresa</label>
                  <input className="form-control form-control-sm" placeholder="ID" value={fEmpresa} onChange={(e) => setFEmpresa(e.target.value)} />
                </div>
                <div className="col-12">
                  <label className="form-label small mb-1">Buscar</label>
                  <input className="form-control form-control-sm" placeholder="ID, titulo o mensaje" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="col-12 d-flex justify-content-end gap-2">
                  <button className="btn btn-sm btn-primary" type="submit" disabled={loading}>Filtrar</button>
                  <button className="btn btn-sm btn-outline-secondary" type="button" disabled={loading} onClick={onClear}>Limpiar</button>
                </div>
              </form>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead><tr><th>ID</th><th>Alcance</th><th>Contenido</th><th>Situacion</th><th>Lecturas</th><th>Fecha</th><th /></tr></thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7}>Cargando...</td></tr>
                    ) : items.length === 0 ? (
                      <tr><td colSpan={7}>Sin resultados</td></tr>
                    ) : items.map((n) => (
                      <tr key={n.id_notification}>
                        <td>{n.id_notification}</td>
                        <td><div className="fw-semibold">{n.scope}</div><small className="text-muted d-block">{n.target_label || '-'}</small>{n.id_empresa ? <small className="text-muted d-block">Emp: {n.id_empresa}</small> : null}</td>
                        <td>
                          <div className="d-flex gap-2 align-items-center flex-wrap"><span className={tipoBadgeClass(n.tipo)}>{n.tipo}</span><span className="fw-semibold">{n.titulo}</span></div>
                          <div className="text-muted" style={{ fontSize: 12 }}>{n.mensaje}</div>
                          <div className="text-muted" style={{ fontSize: 12 }}>Inicia: {fmtDate(n.starts_at)} | Vence: {fmtDate(n.expires_at)}</div>
                        </td>
                        <td><span className={situacionBadgeClass(n.estado_operativo)}>{n.estado_operativo}</span><small className="text-muted d-block">{n.estado === 1 ? 'Activa' : 'Inactiva'}</small></td>
                        <td><button className="btn btn-link btn-sm p-0" type="button" onClick={() => onShowReads(n)}>{n.read_count} lectura{Number(n.read_count) === 1 ? '' : 's'}</button><small className="text-muted d-block">Ult: {fmtDate(n.last_read_at)}</small></td>
                        <td>{fmtDate(n.created_at)}</td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-2 flex-wrap">
                            <button className="btn btn-sm btn-outline-info" onClick={() => onShowReads(n)} type="button">Alcance</button>
                            <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(n)} type="button">Editar</button>
                            <button className={`btn btn-sm ${n.estado === 1 ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => onToggleEstado(n)} type="button">{n.estado === 1 ? 'Desactivar' : 'Activar'}</button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => onArchive(n, n.estado_operativo !== 'ARCHIVADA')} type="button">{n.estado_operativo === 'ARCHIVADA' ? 'Restaurar' : 'Archivar'}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
                <span className="small text-muted">Mostrando {from}-{to} de {total}</span>
                <div className="d-flex align-items-center gap-2">
                  <button className="btn btn-sm btn-outline-secondary" type="button" disabled={!canPrev || loading} onClick={() => loadWithFilters(Math.max(0, offset - limit), limit)}>Anterior</button>
                  <span className="small text-muted">Pagina {currentPage} de {totalPages}</span>
                  <button className="btn btn-sm btn-outline-secondary" type="button" disabled={!canNext || loading} onClick={() => loadWithFilters(offset + limit, limit)}>Siguiente</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default NotificationsPage;
