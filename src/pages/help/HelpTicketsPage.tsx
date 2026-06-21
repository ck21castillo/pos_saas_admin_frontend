import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../../layout/PageLayout';
import {
  getHelpTicket,
  listHelpAdmins,
  listHelpTickets,
  replyHelpTicket,
  updateHelpTicketAsignacion,
  updateHelpTicketEstado,
  updateHelpTicketPrioridad,
  type HelpAdminUser,
  type HelpTicketDetail,
  type HelpTicketEstado,
  type HelpTicketListItem,
  type HelpTicketMessage,
  type HelpTicketPrioridad,
} from '../../api/adminHelp';

type ApiErrorLike = {
  message?: string;
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
};

type TicketFilters = {
  estado: HelpTicketEstado | '';
  prioridad: HelpTicketPrioridad | '';
  q: string;
  empresaId: string;
  assignedTo: string;
  fechaDesde: string;
  fechaHasta: string;
};

const emptyFilters: TicketFilters = {
  estado: '',
  prioridad: '',
  q: '',
  empresaId: '',
  assignedTo: '',
  fechaDesde: '',
  fechaHasta: '',
};

function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object') return fallback;
  const e = error as ApiErrorLike;
  return e.response?.data?.error ?? e.response?.data?.message ?? e.message ?? fallback;
}

function fmtDate(v?: string | null): string {
  if (!v) return '-';
  return v.replace('T', ' ').replace('Z', '');
}

function estadoBadgeClass(estado: HelpTicketEstado): string {
  if (estado === 'ABIERTO') return 'badge bg-warning text-dark';
  if (estado === 'EN_PROCESO') return 'badge bg-info text-dark';
  if (estado === 'RESPONDIDO') return 'badge bg-primary';
  return 'badge bg-success';
}

function prioridadBadgeClass(prioridad: HelpTicketPrioridad): string {
  if (prioridad === 'URGENTE') return 'badge bg-danger';
  if (prioridad === 'ALTA') return 'badge bg-warning text-dark';
  if (prioridad === 'BAJA') return 'badge bg-secondary';
  return 'badge bg-light text-dark border';
}

const HelpTicketsPage: React.FC = () => {
  const [items, setItems] = useState<HelpTicketListItem[]>([]);
  const [admins, setAdmins] = useState<HelpAdminUser[]>([]);
  const [assignmentEnabled, setAssignmentEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TicketFilters>(emptyFilters);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<HelpTicketDetail | null>(null);
  const [messages, setMessages] = useState<HelpTicketMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [estadoSaving, setEstadoSaving] = useState(false);
  const [prioridadSaving, setPrioridadSaving] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  const updateFilter = <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const loadList = async (
    nextOffset = offset,
    nextLimit = limit,
    nextFilters: TicketFilters = filters
  ) => {
    setError(null);
    setLoading(true);
    try {
      const response = await listHelpTickets({
        estado: nextFilters.estado,
        prioridad: nextFilters.prioridad,
        q: nextFilters.q.trim() || undefined,
        id_empresa: nextFilters.empresaId.trim() ? Number(nextFilters.empresaId) : undefined,
        assigned_to: nextFilters.assignedTo === 'none'
          ? 'none'
          : nextFilters.assignedTo.trim()
            ? Number(nextFilters.assignedTo)
            : undefined,
        fecha_desde: nextFilters.fechaDesde || undefined,
        fecha_hasta: nextFilters.fechaHasta || undefined,
        limit: nextLimit,
        offset: nextOffset,
      });
      setItems(response.items);
      setTotal(response.total);
      setLimit(response.limit);
      setOffset(response.offset);
      setAssignmentEnabled(response.assignment_enabled);

      if (response.items.length === 0) {
        setSelectedId(null);
        setDetail(null);
        setMessages([]);
        return;
      }

      const selectedIsVisible = selectedId
        ? response.items.some((item) => item.id_ticket === selectedId)
        : false;
      if (!selectedIsVisible) {
        setSelectedId(response.items[0].id_ticket);
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'No se pudieron cargar los tickets'));
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: number) => {
    setDetailError(null);
    setDetailLoading(true);
    try {
      const out = await getHelpTicket(id);
      setDetail(out.ticket);
      setMessages(out.messages);
      setAssignmentEnabled(out.assignment_enabled);
    } catch (error: unknown) {
      setDetailError(getErrorMessage(error, 'No se pudo cargar el detalle'));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadList(0, limit);
    listHelpAdmins()
      .then(setAdmins)
      .catch(() => setAdmins([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    }
  }, [selectedId]);

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => a.id_message - b.id_message),
    [messages]
  );

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const currentPage = Math.floor(offset / Math.max(1, limit)) + 1;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + items.length, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const onFilter = async () => {
    await loadList(0, limit, filters);
  };

  const onLimitChange = async (value: number) => {
    await loadList(0, value, filters);
  };

  const onClear = async () => {
    setFilters(emptyFilters);
    await loadList(0, limit, emptyFilters);
  };

  const onReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setReplyLoading(true);
    try {
      await replyHelpTicket(selectedId, replyText.trim());
      setReplyText('');
      await loadDetail(selectedId);
      await loadList(offset, limit, filters);
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'No se pudo enviar la respuesta'));
    } finally {
      setReplyLoading(false);
    }
  };

  const onChangeEstado = async (next: HelpTicketEstado) => {
    if (!selectedId) return;
    setEstadoSaving(true);
    try {
      await updateHelpTicketEstado(selectedId, next);
      await loadDetail(selectedId);
      await loadList(offset, limit, filters);
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'No se pudo cambiar estado'));
    } finally {
      setEstadoSaving(false);
    }
  };

  const onChangePrioridad = async (next: HelpTicketPrioridad) => {
    if (!selectedId) return;
    setPrioridadSaving(true);
    try {
      await updateHelpTicketPrioridad(selectedId, next);
      await loadDetail(selectedId);
      await loadList(offset, limit, filters);
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'No se pudo cambiar prioridad'));
    } finally {
      setPrioridadSaving(false);
    }
  };

  const onChangeAsignacion = async (value: string) => {
    if (!selectedId) return;
    setAssignmentSaving(true);
    try {
      await updateHelpTicketAsignacion(selectedId, value ? Number(value) : null);
      await loadDetail(selectedId);
      await loadList(offset, limit, filters);
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'No se pudo cambiar asignacion'));
    } finally {
      setAssignmentSaving(false);
    }
  };

  return (
    <PageLayout
      title="Ayuda"
      right={
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => loadList(offset, limit, filters)}
          type="button"
        >
          Recargar
        </button>
      }
    >
      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                <h5 className="card-title mb-0">Tickets</h5>
                <span className="small text-muted">Total: {total}</span>
              </div>

              <form
                className="row g-2 mb-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  onFilter();
                }}
              >
                <div className="col-12 col-md-6">
                  <label className="form-label small mb-1">Buscar</label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="ID, asunto, contacto o email"
                    value={filters.q}
                    onChange={(e) => updateFilter('q', e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small mb-1">Estado</label>
                  <select
                    className="form-select form-select-sm"
                    value={filters.estado}
                    onChange={(e) => updateFilter('estado', e.target.value as HelpTicketEstado | '')}
                  >
                    <option value="">Todos</option>
                    <option value="ABIERTO">Abierto</option>
                    <option value="EN_PROCESO">En proceso</option>
                    <option value="RESPONDIDO">Respondido</option>
                    <option value="CERRADO">Cerrado</option>
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small mb-1">Prioridad</label>
                  <select
                    className="form-select form-select-sm"
                    value={filters.prioridad}
                    onChange={(e) => updateFilter('prioridad', e.target.value as HelpTicketPrioridad | '')}
                  >
                    <option value="">Todas</option>
                    <option value="URGENTE">Urgente</option>
                    <option value="ALTA">Alta</option>
                    <option value="NORMAL">Normal</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small mb-1">Mostrar</label>
                  <select
                    className="form-select form-select-sm"
                    value={limit}
                    onChange={(e) => onLimitChange(Number(e.target.value))}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label small mb-1">Empresa</label>
                  <input
                    className="form-control form-control-sm"
                    placeholder="ID"
                    value={filters.empresaId}
                    onChange={(e) => updateFilter('empresaId', e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label small mb-1">Asignado</label>
                  <select
                    className="form-select form-select-sm"
                    value={filters.assignedTo}
                    onChange={(e) => updateFilter('assignedTo', e.target.value)}
                    disabled={!assignmentEnabled}
                  >
                    <option value="">Todos</option>
                    <option value="none">Sin asignar</option>
                    {admins.map((admin) => (
                      <option key={admin.id_superadmin} value={admin.id_superadmin}>{admin.email}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small mb-1">Desde</label>
                  <input
                    className="form-control form-control-sm"
                    type="date"
                    value={filters.fechaDesde}
                    onChange={(e) => updateFilter('fechaDesde', e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-4">
                  <label className="form-label small mb-1">Hasta</label>
                  <input
                    className="form-control form-control-sm"
                    type="date"
                    value={filters.fechaHasta}
                    onChange={(e) => updateFilter('fechaHasta', e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4 d-flex justify-content-end gap-2 align-items-end">
                  <button className="btn btn-sm btn-primary" type="submit" disabled={loading}>
                    Filtrar
                  </button>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={loading}
                    onClick={onClear}
                  >
                    Limpiar
                  </button>
                </div>
              </form>

              {error && <div className="alert alert-danger py-2">{error}</div>}
              <div style={{ maxHeight: 520, overflow: 'auto' }}>
                {loading ? (
                  <div className="text-muted">Cargando...</div>
                ) : items.length === 0 ? (
                  <div className="text-muted">Sin tickets</div>
                ) : (
                  <div className="list-group">
                    {items.map((it) => (
                      <button
                        key={it.id_ticket}
                        type="button"
                        className={`list-group-item list-group-item-action ${
                          selectedId === it.id_ticket ? 'active' : ''
                        }`}
                        onClick={() => setSelectedId(it.id_ticket)}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="text-start">
                            <div className="fw-semibold">#{it.id_ticket} - {it.asunto}</div>
                            <div className="small opacity-75">
                              Empresa: {it.id_empresa} {it.empresa_nombre ? `- ${it.empresa_nombre}` : ''}
                            </div>
                            <div className="small opacity-75">
                              {it.contacto_nombre ?? '-'} - {it.contacto_email ?? '-'}
                            </div>
                            <div className="small opacity-75">
                              Asignado: {it.assigned_to_email ?? 'Sin asignar'}
                            </div>
                          </div>
                          <div className="d-flex flex-column align-items-end gap-1">
                            <span className={estadoBadgeClass(it.estado)}>{it.estado}</span>
                            <span className={prioridadBadgeClass(it.prioridad)}>{it.prioridad}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
                <span className="small text-muted">
                  Mostrando {from}-{to} de {total}
                </span>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={!canPrev || loading}
                    onClick={() => loadList(Math.max(0, offset - limit), limit, filters)}
                  >
                    Anterior
                  </button>
                  <span className="small text-muted">
                    Pagina {currentPage} de {totalPages}
                  </span>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={!canNext || loading}
                    onClick={() => loadList(offset + limit, limit, filters)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="card-title mb-3">Detalle</h5>

              {detailError && <div className="alert alert-danger py-2">{detailError}</div>}
              {detailLoading && <div className="text-muted">Cargando detalle...</div>}
              {!detailLoading && !detail && <div className="text-muted">Selecciona un ticket.</div>}

              {!detailLoading && detail && (
                <>
                  <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                    <span className="badge text-bg-dark">#{detail.id_ticket}</span>
                    <span className={estadoBadgeClass(detail.estado)}>{detail.estado}</span>
                    <span className={prioridadBadgeClass(detail.prioridad)}>{detail.prioridad}</span>
                    <span className="badge text-bg-secondary">Empresa {detail.id_empresa}</span>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label small mb-1">Estado</label>
                      <select
                        className="form-select form-select-sm"
                        value={detail.estado}
                        onChange={(e) => onChangeEstado(e.target.value as HelpTicketEstado)}
                        disabled={estadoSaving}
                      >
                        <option value="ABIERTO">ABIERTO</option>
                        <option value="EN_PROCESO">EN_PROCESO</option>
                        <option value="RESPONDIDO">RESPONDIDO</option>
                        <option value="CERRADO">CERRADO</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small mb-1">Prioridad</label>
                      <select
                        className="form-select form-select-sm"
                        value={detail.prioridad}
                        onChange={(e) => onChangePrioridad(e.target.value as HelpTicketPrioridad)}
                        disabled={prioridadSaving}
                      >
                        <option value="URGENTE">URGENTE</option>
                        <option value="ALTA">ALTA</option>
                        <option value="NORMAL">NORMAL</option>
                        <option value="BAJA">BAJA</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small mb-1">Asignado a</label>
                      <select
                        className="form-select form-select-sm"
                        value={detail.assigned_to ?? ''}
                        onChange={(e) => onChangeAsignacion(e.target.value)}
                        disabled={!assignmentEnabled || assignmentSaving}
                      >
                        <option value="">Sin asignar</option>
                        {admins.map((admin) => (
                          <option key={admin.id_superadmin} value={admin.id_superadmin}>{admin.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="fw-semibold">{detail.asunto}</div>
                    <div className="small text-muted">
                      Contacto: {detail.contacto_nombre ?? '-'} - {detail.contacto_email ?? '-'}
                    </div>
                    <div className="small text-muted">
                      Asignado: {detail.assigned_to_email ?? 'Sin asignar'}
                    </div>
                    <div className="small text-muted">
                      Creado: {fmtDate(detail.created_at)} - Actualizado: {fmtDate(detail.updated_at)}
                    </div>
                  </div>

                  <div
                    className="border rounded p-2 mb-3"
                    style={{ maxHeight: 320, overflow: 'auto', background: '#f8f9fa' }}
                  >
                    {orderedMessages.length === 0 ? (
                      <div className="text-muted">Sin mensajes</div>
                    ) : (
                      orderedMessages.map((m) => (
                        <div key={m.id_message} className="mb-2">
                          <div className="small">
                            <strong>{m.actor_tipo}</strong> - {fmtDate(m.created_at)}
                          </div>
                          <div>{m.mensaje}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Responder</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Escribe una respuesta para el cliente..."
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={replyLoading || !replyText.trim()}
                    onClick={onReply}
                  >
                    {replyLoading ? 'Enviando...' : 'Enviar respuesta'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default HelpTicketsPage;
