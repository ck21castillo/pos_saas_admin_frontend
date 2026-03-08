import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import { getEmpresaUsuarioAdmin, listEmpresas, type Empresa } from '../../api/adminEmpresas';
import {
  createAdminNotification,
  listAdminNotifications,
  setAdminNotificationEstado,
  updateAdminNotification,
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
  if (!s) return '-';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return dateTimeFormatter.format(d);
}

function fullName(nombre?: string | null, apellido?: string | null) {
  return `${nombre ?? ''} ${apellido ?? ''}`.trim();
}

const NotificationsPage: React.FC = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  const [scope, setScope] = useState<NotificationScope>('GLOBAL');
  const [idEmpresa, setIdEmpresa] = useState<string>('');
  const [adminDestino, setAdminDestino] = useState<{ id_usuario: number; nombre: string; email: string } | null>(null);
  const [loadingAdminDestino, setLoadingAdminDestino] = useState(false);
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

  const loadWithFilters = async (overrides?: {
    scope?: NotificationScope | '';
    estado?: 0 | 1 | '';
    empresa?: string;
    query?: string;
  }) => {
    const scopeValue = overrides?.scope ?? fScope;
    const estadoValue = overrides?.estado ?? fEstado;
    const empresaValue = overrides?.empresa ?? fEmpresa;
    const queryValue = overrides?.query ?? q;

    setLoading(true);
    try {
      const rows = await listAdminNotifications({
        scope: scopeValue,
        estado: estadoValue,
        id_empresa: empresaValue.trim() ? Number(empresaValue) : undefined,
        q: queryValue.trim() || undefined,
        limit: 150,
      });
      setItems(rows);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo cargar notificaciones'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const load = async () => {
    await loadWithFilters();
  };

  const loadAdminDestino = async (empresaId: number) => {
    setLoadingAdminDestino(true);
    try {
      const out = await getEmpresaUsuarioAdmin(empresaId);
      const n = fullName(out.item.nombre, out.item.apellido) || '(Sin nombre)';
      setAdminDestino({
        id_usuario: out.item.id_usuario,
        nombre: n,
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
    void load();
    // carga inicial
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

  const countByScope = useMemo(() => {
    const acc = { GLOBAL: 0, EMPRESA: 0, USUARIO: 0 };
    for (const n of items) {
      if (n.scope === 'GLOBAL' || n.scope === 'EMPRESA' || n.scope === 'USUARIO') {
        acc[n.scope] += 1;
      }
    }
    return acc;
  }, [items]);

  const canCreate = useMemo(() => {
    if (!titulo.trim() || !mensaje.trim()) return false;
    if (scope === 'EMPRESA' && !idEmpresa.trim()) return false;
    if (scope === 'USUARIO' && (!idEmpresa.trim() || !adminDestino?.id_usuario)) return false;
    return true;
  }, [scope, idEmpresa, adminDestino, titulo, mensaje]);

  const onCreate = async () => {
    if (!canCreate) {
      Swal.fire('Campos requeridos', 'Completa los campos obligatorios segun el alcance.', 'info');
      return;
    }

    const ok = await Swal.fire({
      title: 'Crear notificacion',
      text: 'Deseas enviar esta notificacion?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Si, crear',
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
      if (scope === 'USUARIO' && adminDestino?.id_usuario) payload.id_usuario = adminDestino.id_usuario;

      const out = await createAdminNotification(payload);
      await Swal.fire('Creada', `Notificacion #${out.id_notification}`, 'success');

      setTitulo('');
      setMensaje('');
      if (scope === 'GLOBAL') setIdEmpresa('');

      await load();
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo crear notificacion'), 'error');
    } finally {
      setCreating(false);
    }
  };

  const onEdit = async (n: AdminNotificationItem) => {
    const { isConfirmed, value } = await Swal.fire({
      title: `Editar #${n.id_notification}`,
      html: `
        <div style="text-align:left">
          <label style="display:block;margin-bottom:6px;">Titulo</label>
          <input id="swal-titulo" class="swal2-input" maxlength="180" value="${(n.titulo || '').replace(/"/g, '&quot;')}" style="width:100%;margin:0 0 12px 0;" />
          <label style="display:block;margin-bottom:6px;">Mensaje</label>
          <textarea id="swal-mensaje" class="swal2-textarea" rows="5" style="width:100%;margin:0 0 12px 0;resize:vertical;">${n.mensaje || ''}</textarea>
          <label style="display:block;margin-bottom:6px;">Tipo</label>
          <select id="swal-tipo" class="swal2-select" style="width:100%;margin:0;">
            <option value="INFO" ${n.tipo === 'INFO' ? 'selected' : ''}>INFORMATIVO</option>
            <option value="SUCCESS" ${n.tipo === 'SUCCESS' ? 'selected' : ''}>EXITO</option>
            <option value="WARNING" ${n.tipo === 'WARNING' ? 'selected' : ''}>ADVERTENCIA</option>
            <option value="ERROR" ${n.tipo === 'ERROR' ? 'selected' : ''}>ERROR</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar cambios',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        const tituloEl = document.getElementById('swal-titulo') as HTMLInputElement | null;
        const mensajeEl = document.getElementById('swal-mensaje') as HTMLTextAreaElement | null;
        const tipoEl = document.getElementById('swal-tipo') as HTMLSelectElement | null;

        const tituloVal = (tituloEl?.value ?? '').trim();
        const mensajeVal = (mensajeEl?.value ?? '').trim();
        const tipoVal = (tipoEl?.value ?? 'INFO') as NotificationTipo;

        if (!tituloVal || !mensajeVal) {
          Swal.showValidationMessage('Titulo y mensaje son obligatorios.');
          return;
        }

        return { titulo: tituloVal, mensaje: mensajeVal, tipo: tipoVal };
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

  const onScopeChipClick = (nextScope: NotificationScope | '') => {
    setFScope(nextScope);
    void loadWithFilters({ scope: nextScope });
  };

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
                  <label className="form-label">Usuario destino</label>
                  <div className="form-control bg-light" style={{ minHeight: 42 }}>
                    {loadingAdminDestino
                      ? 'Buscando administrador...'
                      : adminDestino
                        ? `${adminDestino.nombre} (${adminDestino.email})`
                        : 'Selecciona una empresa para cargar su administrador'}
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

              <div className="mb-3">
                <label className="form-label">Mensaje</label>
                <textarea className="form-control" rows={4} value={mensaje} onChange={(e) => setMensaje(e.target.value)} />
              </div>

              <button className="btn btn-primary w-100" disabled={creating || !canCreate} onClick={onCreate} type="button">
                {creating ? 'Creando...' : 'Crear notificacion'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h5 className="card-title mb-0">Historico</h5>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={load}
                  type="button"
                  aria-label="Recargar historico de notificaciones"
                >
                  Recargar
                </button>
              </div>

              <div className="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className={`btn btn-sm ${fScope === '' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onScopeChipClick('')}
                >
                  Todas ({items.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${fScope === 'GLOBAL' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onScopeChipClick('GLOBAL')}
                >
                  Globales ({countByScope.GLOBAL})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${fScope === 'EMPRESA' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onScopeChipClick('EMPRESA')}
                >
                  Empresa ({countByScope.EMPRESA})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${fScope === 'USUARIO' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => onScopeChipClick('USUARIO')}
                >
                  Usuario ({countByScope.USUARIO})
                </button>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-12 col-md-3">
                  <select className="form-select form-select-sm" value={fScope} onChange={(e) => setFScope(parseScopeFilter(e.target.value))}>
                    <option value="">Alcance: todos</option>
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
                  <input className="form-control form-control-sm" placeholder="Buscar titulo/mensaje" value={q} onChange={(e) => setQ(e.target.value)} />
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
                      <th style={{ width: 120 }}>Categoria</th>
                      <th>Contenido</th>
                      <th style={{ width: 110 }}>Estado</th>
                      <th style={{ width: 170 }}>Fecha</th>
                      <th style={{ width: 220 }} />
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
                            <div className="fw-semibold">{n.scope}</div>
                            {n.id_empresa ? <small className="text-muted d-block">Emp: {n.id_empresa}</small> : null}
                            {n.id_usuario ? <small className="text-muted d-block">Usr: {n.id_usuario}</small> : null}
                          </td>
                          <td>
                            <div className="fw-semibold">{n.titulo}</div>
                            <div className="text-muted" style={{ fontSize: 12 }}>{n.mensaje}</div>
                            {n.usuario_nombre || n.usuario_email ? (
                              <div className="text-muted" style={{ fontSize: 12 }}>
                                Destino: {n.usuario_nombre || n.usuario_email}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {n.estado === 1 ? <span className="badge bg-success">Activa</span> : <span className="badge bg-secondary">Inactiva</span>}
                          </td>
                          <td>{fmtDate(n.created_at)}</td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end gap-2">
                              <button className="btn btn-sm btn-outline-primary" onClick={() => onEdit(n)} type="button">
                                Editar
                              </button>
                              <button
                                className={`btn btn-sm ${n.estado === 1 ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                onClick={() => onToggleEstado(n)}
                                type="button"
                              >
                                {n.estado === 1 ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
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
