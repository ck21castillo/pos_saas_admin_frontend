import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import { listEmpresas, type Empresa } from '../../api/adminEmpresas';
import {
  createAdminNotification,
  listAdminNotifications,
  setAdminNotificationEstado,
  type AdminNotificationItem,
  type NotificationScope,
  type NotificationTipo,
} from '../../api/adminNotifications';

type ApiErrorLike = {
  message?: string;
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
};

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as ApiErrorLike;
  return e.response?.data?.error ?? e.response?.data?.message ?? e.message ?? fallback;
}

function parseScopeFilter(value: string): NotificationScope | '' {
  if (value === '' || value === 'GLOBAL' || value === 'EMPRESA' || value === 'USUARIO') return value;
  return '';
}

function parseEstadoFilter(value: string): 0 | 1 | '' {
  if (value === '') return '';
  if (value === '1') return 1;
  if (value === '0') return 0;
  return '';
}

function fmtDate(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return dateTimeFormatter.format(d);
}

const NotificationsPage: React.FC = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const [scope, setScope] = useState<NotificationScope>('GLOBAL');
  const [idEmpresa, setIdEmpresa] = useState<string>('');
  const [idUsuario, setIdUsuario] = useState<string>('');
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [tipo, setTipo] = useState<NotificationTipo>('INFO');
  const [creating, setCreating] = useState(false);

  const [fScope, setFScope] = useState<NotificationScope | ''>('');
  const [fEstado, setFEstado] = useState<0 | 1 | ''>('');
  const [fEmpresa, setFEmpresa] = useState<string>('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEmpresas = async () => {
    const out = await listEmpresas({ limit: 200, offset: 0 });
    setEmpresas(out.items);
  };

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listAdminNotifications({
        scope: fScope,
        estado: fEstado,
        id_empresa: fEmpresa.trim() ? Number(fEmpresa) : undefined,
        q: q.trim() || undefined,
        limit: 100,
      });
      setItems(rows);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo cargar notificaciones'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmpresas();
    load();
    // Carga inicial intencional; recarga posterior es manual con botón "Filtrar/Recargar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = useMemo(() => {
    if (!titulo.trim() || !mensaje.trim()) return false;
    if (scope === 'EMPRESA' && !idEmpresa.trim()) return false;
    if (scope === 'USUARIO' && (!idEmpresa.trim() || !idUsuario.trim())) return false;
    return true;
  }, [scope, idEmpresa, idUsuario, titulo, mensaje]);

  const onCreate = async () => {
    if (!canCreate) {
      Swal.fire('Campos requeridos', 'Completa los campos obligatorios según el alcance.', 'info');
      return;
    }

    const ok = await Swal.fire({
      title: 'Crear notificación',
      text: '¿Deseas enviar esta notificación?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, crear',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;

    setCreating(true);
    try {
      const payload: Parameters<typeof createAdminNotification>[0] = {
        scope,
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
        tipo,
      };
      if (scope !== 'GLOBAL') payload.id_empresa = Number(idEmpresa);
      if (scope === 'USUARIO') payload.id_usuario = Number(idUsuario);

      const out = await createAdminNotification(payload);
      await Swal.fire('Creada', `Notificación #${out.id_notification}`, 'success');
      setTitulo('');
      setMensaje('');
      setIdUsuario('');
      if (scope === 'GLOBAL') setIdEmpresa('');
      await load();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo crear notificación'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const onToggleEstado = async (n: AdminNotificationItem) => {
    const next = n.estado === 1 ? 0 : 1;
    const verb = next === 1 ? 'activar' : 'desactivar';
    const ok = await Swal.fire({
      title: `${verb[0].toUpperCase()}${verb.slice(1)} notificación`,
      text: `#${n.id_notification} - ${n.titulo}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
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

  return (
    <PageLayout title="Notificaciones">
      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">Nueva notificación</h5>

              <div className="mb-2">
                <label className="form-label">Alcance</label>
                <select className="form-select" value={scope} onChange={(e) => setScope(e.target.value as NotificationScope)}>
                  <option value="GLOBAL">GLOBAL</option>
                  <option value="EMPRESA">EMPRESA</option>
                  <option value="USUARIO">USUARIO</option>
                </select>
              </div>

              {(scope === 'EMPRESA' || scope === 'USUARIO') && (
                <div className="mb-2">
                  <label className="form-label">Empresa</label>
                  <select className="form-select" value={idEmpresa} onChange={(e) => setIdEmpresa(e.target.value)}>
                    <option value="">Selecciona...</option>
                    {empresas.map((e) => (
                      <option key={e.id_empresa} value={String(e.id_empresa)}>
                        {e.id_empresa} - {e.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {scope === 'USUARIO' && (
                <div className="mb-2">
                  <label className="form-label">ID usuario</label>
                  <input
                    className="form-control"
                    value={idUsuario}
                    onChange={(e) => setIdUsuario(e.target.value)}
                    placeholder="Ej: 15"
                  />
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
                <label className="form-label">Título</label>
                <input className="form-control" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={180} />
              </div>

              <div className="mb-3">
                <label className="form-label">Mensaje</label>
                <textarea className="form-control" rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
              </div>

              <button className="btn btn-primary w-100" disabled={creating} onClick={onCreate} type="button">
                {creating ? 'Creando...' : 'Crear notificación'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="card-title mb-0">Histórico</h5>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={load}
                  type="button"
                  aria-label="Recargar histórico de notificaciones"
                >
                  Recargar
                </button>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-12 col-md-3">
                  <select className="form-select form-select-sm" value={fScope} onChange={(e) => setFScope(parseScopeFilter(e.target.value))}>
                    <option value="">Scope: todos</option>
                    <option value="GLOBAL">GLOBAL</option>
                    <option value="EMPRESA">EMPRESA</option>
                    <option value="USUARIO">USUARIO</option>
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <select className="form-select form-select-sm" value={fEstado} onChange={(e) => setFEstado(parseEstadoFilter(e.target.value))}>
                    <option value="">Estado: todos</option>
                    <option value="1">Activas</option>
                    <option value="0">Inactivas</option>
                  </select>
                </div>
                <div className="col-12 col-md-2">
                  <input className="form-control form-control-sm" placeholder="Empresa ID" value={fEmpresa} onChange={(e) => setFEmpresa(e.target.value)} />
                </div>
                <div className="col-12 col-md-4 d-flex gap-2">
                  <input className="form-control form-control-sm" placeholder="Buscar título/mensaje" value={q} onChange={(e) => setQ(e.target.value)} />
                  <button className="btn btn-sm btn-primary" onClick={load} type="button" aria-label="Aplicar filtros">
                    Filtrar
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>ID</th>
                      <th style={{ width: 100 }}>Scope</th>
                      <th>Título</th>
                      <th style={{ width: 110 }}>Estado</th>
                      <th style={{ width: 170 }}>Fecha</th>
                      <th style={{ width: 120 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6}>Cargando...</td></tr>
                    ) : items.length === 0 ? (
                      <tr><td colSpan={6}>Sin resultados</td></tr>
                    ) : (
                      items.map((n) => (
                        <tr key={n.id_notification}>
                          <td>{n.id_notification}</td>
                          <td>
                            <div>{n.scope}</div>
                            {n.id_empresa ? <small className="text-muted">Emp: {n.id_empresa}</small> : null}
                            {n.id_usuario ? <small className="text-muted d-block">Usr: {n.id_usuario}</small> : null}
                          </td>
                          <td>
                            <div className="fw-semibold">{n.titulo}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>{n.mensaje}</div>
                          </td>
                          <td>
                            {n.estado === 1 ? <span className="badge bg-success">Activa</span> : <span className="badge bg-secondary">Inactiva</span>}
                          </td>
                          <td>{fmtDate(n.created_at)}</td>
                          <td className="text-end">
                            <button
                              className={`btn btn-sm ${n.estado === 1 ? 'btn-outline-danger' : 'btn-outline-success'}`}
                              onClick={() => onToggleEstado(n)}
                              type="button"
                            >
                              {n.estado === 1 ? 'Desactivar' : 'Activar'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default NotificationsPage;
