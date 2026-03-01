import React, { useEffect, useMemo, useState } from 'react';
import PageLayout from '../../layout/PageLayout';
import {
  getHelpTicket,
  listHelpTickets,
  replyHelpTicket,
  updateHelpTicketEstado,
  type HelpTicketDetail,
  type HelpTicketEstado,
  type HelpTicketListItem,
  type HelpTicketMessage,
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

const HelpTicketsPage: React.FC = () => {
  const [items, setItems] = useState<HelpTicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [estado, setEstado] = useState<HelpTicketEstado | ''>('');
  const [q, setQ] = useState('');
  const [empresaId, setEmpresaId] = useState('');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<HelpTicketDetail | null>(null);
  const [messages, setMessages] = useState<HelpTicketMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [estadoSaving, setEstadoSaving] = useState(false);

  const loadList = async () => {
    setError(null);
    setLoading(true);
    try {
      const rows = await listHelpTickets({
        estado,
        q: q.trim() || undefined,
        id_empresa: empresaId.trim() ? Number(empresaId) : undefined,
        limit: 100,
      });
      setItems(rows);

      if (rows.length > 0 && !selectedId) {
        setSelectedId(rows[0].id_ticket);
      }
      if (rows.length === 0) {
        setSelectedId(null);
        setDetail(null);
        setMessages([]);
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
    } catch (error: unknown) {
      setDetailError(getErrorMessage(error, 'No se pudo cargar el detalle'));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    loadList();
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

  const onReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setReplyLoading(true);
    try {
      await replyHelpTicket(selectedId, replyText.trim());
      setReplyText('');
      await loadDetail(selectedId);
      await loadList();
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
      await loadList();
    } catch (error: unknown) {
      alert(getErrorMessage(error, 'No se pudo cambiar estado'));
    } finally {
      setEstadoSaving(false);
    }
  };

  return (
    <PageLayout
      title="Ayuda"
      right={
        <button className="btn btn-outline-secondary btn-sm" onClick={loadList} type="button">
          Recargar
        </button>
      }
    >
      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="card-title mb-3">Tickets</h5>

              <div className="row g-2 mb-3">
                <div className="col-12 col-md-4">
                  <select
                    className="form-select form-select-sm"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as HelpTicketEstado | '')}
                  >
                    <option value="">Todos</option>
                    <option value="ABIERTO">ABIERTO</option>
                    <option value="EN_PROCESO">EN_PROCESO</option>
                    <option value="RESPONDIDO">RESPONDIDO</option>
                    <option value="CERRADO">CERRADO</option>
                  </select>
                </div>
                <div className="col-12 col-md-4">
                  <input
                    className="form-control form-control-sm"
                    placeholder="ID empresa"
                    value={empresaId}
                    onChange={(e) => setEmpresaId(e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4">
                  <button className="btn btn-sm btn-primary w-100" type="button" onClick={loadList}>
                    Filtrar
                  </button>
                </div>
                <div className="col-12">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Buscar por asunto/contacto/email..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>

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
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">#{it.id_ticket} · {it.asunto}</div>
                            <div className="small opacity-75">
                              Empresa: {it.id_empresa} {it.empresa_nombre ? `- ${it.empresa_nombre}` : ''}
                            </div>
                            <div className="small opacity-75">
                              {it.contacto_nombre ?? '-'} · {it.contacto_email ?? '-'}
                            </div>
                          </div>
                          <span className={estadoBadgeClass(it.estado)}>{it.estado}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
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
                    <span className="badge text-bg-secondary">Empresa {detail.id_empresa}</span>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 180 }}
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

                  <div className="mb-3">
                    <div className="fw-semibold">{detail.asunto}</div>
                    <div className="small text-muted">
                      Contacto: {detail.contacto_nombre ?? '-'} · {detail.contacto_email ?? '-'}
                    </div>
                    <div className="small text-muted">
                      Creado: {fmtDate(detail.created_at)} · Actualizado: {fmtDate(detail.updated_at)}
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
                            <strong>{m.actor_tipo}</strong> · {fmtDate(m.created_at)}
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
