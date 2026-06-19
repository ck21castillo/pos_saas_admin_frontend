import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import {
  createInvitation,
  listInvitationRequests,
  listInvitations,
  type InvitationEmailTemplate,
  type InvitationRequestEstado,
  type InvitationRequestRow,
  type InvitationRow,
  updateInvitationRequest,
} from '../../api/adminOnboarding';
import '../../styles/onboarding.css';

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

function parseRequestEstado(value: string): InvitationRequestEstado {
  if (value === 'PENDIENTE' || value === 'APROBADA' || value === 'RECHAZADA') return value;
  return 'PENDIENTE';
}

function parseEmailTemplate(value: string): InvitationEmailTemplate {
  return value === 'meta' ? 'meta' : 'cliente';
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '-';
  return s.replace('T', ' ').replace('Z', '');
}

function planLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    esencial: 'Esencial mensual',
    pro: 'Pro mensual',
    anual_esencial: 'Esencial anual',
    anual_pro: 'Pro anual',
    no_seguro: 'No esta seguro',
  };
  return labels[String(value ?? '').trim()] ?? '-';
}

function compactText(value: string | null | undefined, max = 140): string {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pagination(total: number, offset: number, limit: number, currentRows: number) {
  return {
    page: Math.floor(offset / Math.max(1, limit)) + 1,
    pages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + currentRows, total),
    canPrev: offset > 0,
    canNext: offset + limit < total,
  };
}

const OnboardingPage: React.FC = () => {
  const [tab, setTab] = useState<'requests' | 'invitations'>('requests');

  const [reqEstado, setReqEstado] = useState<InvitationRequestEstado>('PENDIENTE');
  const [reqRows, setReqRows] = useState<InvitationRequestRow[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqTotal, setReqTotal] = useState(0);
  const [reqLimit, setReqLimit] = useState(25);
  const [reqOffset, setReqOffset] = useState(0);

  const [invEmail, setInvEmail] = useState('');
  const [invDays, setInvDays] = useState(7);
  const [invTemplate, setInvTemplate] = useState<InvitationEmailTemplate>('cliente');
  const [invRows, setInvRows] = useState<InvitationRow[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [invTotal, setInvTotal] = useState(0);
  const [invLimit, setInvLimit] = useState(25);
  const [invOffset, setInvOffset] = useState(0);

  const [lastInvite, setLastInvite] = useState<null | {
    email: string;
    invite_code: string;
    expires_at: string;
    email_template: InvitationEmailTemplate;
    email_sent: boolean;
    email_error: string | null;
  }>(null);

  const reqPage = useMemo(
    () => pagination(reqTotal, reqOffset, reqLimit, reqRows.length),
    [reqTotal, reqOffset, reqLimit, reqRows.length]
  );
  const invPage = useMemo(
    () => pagination(invTotal, invOffset, invLimit, invRows.length),
    [invTotal, invOffset, invLimit, invRows.length]
  );

  const requestsWithMessage = useMemo(
    () => reqRows.filter((r) => String(r.mensaje ?? '').trim() !== ''),
    [reqRows]
  );

  const loadRequests = useCallback(async (nextOffset = reqOffset, nextLimit = reqLimit, nextEstado = reqEstado) => {
    setReqError(null);
    setReqLoading(true);
    try {
      const response = await listInvitationRequests(nextEstado, { limit: nextLimit, offset: nextOffset });
      setReqRows(response.rows);
      setReqTotal(response.total);
      setReqLimit(response.limit);
      setReqOffset(response.offset);
    } catch (error: unknown) {
      setReqError(getErrorMessage(error, 'No se pudieron cargar las solicitudes'));
    } finally {
      setReqLoading(false);
    }
  }, [reqEstado, reqLimit, reqOffset]);

  const loadInvitations = useCallback(async (email = invEmail.trim().toLowerCase(), nextOffset = invOffset, nextLimit = invLimit) => {
    setInvError(null);
    setInvLoading(true);
    try {
      const response = await listInvitations(email || undefined, { limit: nextLimit, offset: nextOffset });
      setInvRows(response.rows);
      setInvTotal(response.total);
      setInvLimit(response.limit);
      setInvOffset(response.offset);
    } catch (error: unknown) {
      setInvError(getErrorMessage(error, 'No se pudieron cargar las invitaciones'));
    } finally {
      setInvLoading(false);
    }
  }, [invEmail, invLimit, invOffset]);

  useEffect(() => {
    if (tab === 'requests') void loadRequests(0, reqLimit, reqEstado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reqEstado]);

  useEffect(() => {
    if (tab === 'invitations') void loadInvitations(invEmail.trim().toLowerCase(), 0, invLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const showInvite = (out: Awaited<ReturnType<typeof createInvitation>>) => {
    setLastInvite({
      email: out.email,
      invite_code: out.invite_code,
      expires_at: out.expires_at,
      email_template: out.email_template,
      email_sent: out.email_sent,
      email_error: out.email_error,
    });
  };

  const copyLastInvite = async () => {
    if (!lastInvite) return;
    await navigator.clipboard.writeText(lastInvite.invite_code);
    await Swal.fire('Copiado', 'Codigo copiado al portapapeles.', 'success');
  };

  const doReject = async (r: InvitationRequestRow) => {
    const { isConfirmed, value } = await Swal.fire({
      title: 'Rechazar solicitud',
      input: 'textarea',
      inputLabel: 'Notas internas',
      inputValue: r.notas ?? '',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
    });
    if (!isConfirmed) return;

    try {
      await updateInvitationRequest(r.id_request, { estado: 'RECHAZADA', notas: String(value ?? '') });
      await loadRequests(reqOffset, reqLimit, reqEstado);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo rechazar'), 'error');
    }
  };

  const doGenerateFromRequest = async (r: InvitationRequestRow) => {
    const { isConfirmed, value } = await Swal.fire({
      title: 'Generar invitacion',
      html: `
        <div style="text-align:left">
          <p><strong>${r.email}</strong></p>
          <label style="display:block;margin-bottom:6px;">Dias de vigencia</label>
          <input id="invite-days" class="swal2-input" type="number" min="1" max="90" value="7" style="width:100%;margin:0 0 12px 0;" />
          <label style="display:block;margin-bottom:6px;">Plantilla</label>
          <select id="invite-template" class="swal2-select" style="width:100%;margin:0;">
            <option value="cliente">Cliente real</option>
            <option value="meta">Meta</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Generar y enviar',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        const daysEl = document.getElementById('invite-days') as HTMLInputElement | null;
        const templateEl = document.getElementById('invite-template') as HTMLSelectElement | null;
        return {
          days: clampInt(parseInt(daysEl?.value || '7', 10) || 7, 1, 90),
          template: parseEmailTemplate(templateEl?.value ?? 'cliente'),
        };
      },
    });
    if (!isConfirmed || !value) return;

    try {
      const out = await createInvitation({ email: r.email, days: value.days, email_template: value.template });
      showInvite(out);
      await updateInvitationRequest(r.id_request, {
        estado: 'APROBADA',
        notas: 'Invitacion generada desde panel admin',
      });
      await loadRequests(reqOffset, reqLimit, reqEstado);
      if (tab === 'invitations') await loadInvitations(invEmail.trim().toLowerCase(), invOffset, invLimit);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo generar la invitacion'), 'error');
    }
  };

  const doCreateInviteForEmail = async () => {
    const email = invEmail.trim().toLowerCase();
    if (!email) return;
    try {
      const out = await createInvitation({ email, days: invDays, email_template: invTemplate });
      showInvite(out);
      await loadInvitations(email, 0, invLimit);
    } catch (error: unknown) {
      Swal.fire('Error', getErrorMessage(error, 'No se pudo generar la invitacion'), 'error');
    }
  };

  return (
    <PageLayout title="Onboarding">
      <div className="onboarding-page">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <ul className="nav nav-pills">
            <li className="nav-item">
              <button className={`nav-link ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')} type="button">
                Solicitudes
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${tab === 'invitations' ? 'active' : ''}`} onClick={() => setTab('invitations')} type="button">
                Invitaciones
              </button>
            </li>
          </ul>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {tab === 'requests' ? `${reqTotal} solicitudes` : `${invTotal} invitaciones`}
          </div>
        </div>

        {lastInvite && (
          <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <div className="fw-semibold">Invitacion creada para {lastInvite.email}</div>
              <div className="small">Expira: {fmtDate(lastInvite.expires_at)} - Plantilla: {lastInvite.email_template}</div>
              <div className="small">Correo: {lastInvite.email_sent ? 'enviado' : 'no enviado'}</div>
              {lastInvite.email_error && <div className="small text-warning">Error correo: {lastInvite.email_error}</div>}
              <div className="mt-2" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {lastInvite.invite_code}
              </div>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-primary" type="button" onClick={copyLastInvite}>Copiar</button>
              <button className="btn btn-outline-secondary" type="button" onClick={() => setLastInvite(null)}>Cerrar</button>
            </div>
          </div>
        )}

        {tab === 'requests' && (
          <div className="card">
            <div className="card-body">
              <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
                <div className="d-flex flex-wrap align-items-end gap-2">
                  <div>
                    <label className="form-label small mb-1">Estado</label>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 160 }}
                      value={reqEstado}
                      onChange={(e) => {
                        const next = parseRequestEstado(e.target.value);
                        setReqEstado(next);
                        setReqOffset(0);
                      }}
                    >
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="APROBADA">APROBADA</option>
                      <option value="RECHAZADA">RECHAZADA</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label small mb-1">Mostrar</label>
                    <select
                      className="form-select form-select-sm"
                      style={{ width: 105 }}
                      value={reqLimit}
                      onChange={(e) => loadRequests(0, Number(e.target.value), reqEstado)}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                  <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => loadRequests(reqOffset, reqLimit, reqEstado)}>
                    Recargar
                  </button>
                </div>
                <div className="text-muted" style={{ fontSize: 13 }}>
                  {requestsWithMessage.length} con mensaje adicional en esta pagina
                </div>
              </div>

              {reqError && <div className="alert alert-danger">{reqError}</div>}

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>ID</th>
                      <th>Email</th>
                      <th>Negocio</th>
                      <th style={{ width: 150 }}>Telefono</th>
                      <th style={{ width: 150 }}>Plan</th>
                      <th style={{ minWidth: 240 }}>Contexto</th>
                      <th style={{ width: 130 }}>Estado</th>
                      <th style={{ width: 170 }}>Fecha</th>
                      <th style={{ width: 260 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reqLoading ? (
                      <tr><td colSpan={9} className="text-muted">Cargando...</td></tr>
                    ) : reqRows.length === 0 ? (
                      <tr><td colSpan={9} className="text-muted">Sin resultados</td></tr>
                    ) : (
                      reqRows.map((r) => (
                        <tr key={r.id_request}>
                          <td>{r.id_request}</td>
                          <td>
                            <div className="fw-semibold">{r.email}</div>
                            {r.ip && <div className="text-muted" style={{ fontSize: 12 }}>{r.ip}</div>}
                          </td>
                          <td>{r.empresa_nombre || <span className="text-muted">-</span>}</td>
                          <td>{r.telefono || <span className="text-muted">-</span>}</td>
                          <td>{planLabel(r.plan_solicitado)}</td>
                          <td>{r.mensaje ? compactText(r.mensaje) : <span className="text-muted">Sin mensaje</span>}</td>
                          <td>
                            <span className={r.estado === 'PENDIENTE' ? 'badge bg-warning text-dark' : r.estado === 'APROBADA' ? 'badge bg-success' : 'badge bg-danger'}>
                              {r.estado}
                            </span>
                          </td>
                          <td>{fmtDate(r.created_at)}</td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => doReject(r)} disabled={r.estado === 'RECHAZADA'}>
                                Rechazar
                              </button>
                              <button className="btn btn-sm btn-primary" type="button" onClick={() => doGenerateFromRequest(r)}>
                                Generar y enviar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
                <span className="small text-muted">Mostrando {reqPage.from}-{reqPage.to} de {reqTotal}</span>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={!reqPage.canPrev || reqLoading}
                    onClick={() => loadRequests(Math.max(0, reqOffset - reqLimit), reqLimit, reqEstado)}
                  >
                    Anterior
                  </button>
                  <span className="small text-muted">Pagina {reqPage.page} de {reqPage.pages}</span>
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    disabled={!reqPage.canNext || reqLoading}
                    onClick={() => loadRequests(reqOffset + reqLimit, reqLimit, reqEstado)}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'invitations' && (
          <div className="row g-3">
            <div className="col-12 col-lg-5">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title mb-3">Generar invitacion</h5>

                  {invError && <div className="alert alert-danger">{invError}</div>}

                  <div className="mb-2">
                    <label className="form-label">Email</label>
                    <input
                      className="form-control"
                      value={invEmail}
                      onChange={(e) => setInvEmail(e.target.value)}
                      placeholder="cliente@correo.com"
                      type="email"
                      autoComplete="off"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Dias de vigencia</label>
                    <input
                      className="form-control"
                      value={String(invDays)}
                      onChange={(e) => setInvDays(clampInt(parseInt(e.target.value || '7', 10) || 7, 1, 90))}
                      type="number"
                      min={1}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Plantilla de correo</label>
                    <select className="form-select" value={invTemplate} onChange={(e) => setInvTemplate(parseEmailTemplate(e.target.value))}>
                      <option value="cliente">Cliente real</option>
                      <option value="meta">Meta</option>
                    </select>
                  </div>

                  <div className="d-flex gap-2">
                    <button className="btn btn-primary" type="button" disabled={invLoading || !invEmail.trim()} onClick={doCreateInviteForEmail}>
                      Generar y enviar
                    </button>
                    <button className="btn btn-outline-secondary" type="button" disabled={invLoading} onClick={() => loadInvitations(invEmail.trim().toLowerCase(), 0, invLimit)}>
                      Buscar
                    </button>
                  </div>

                  <div className="text-muted mt-3" style={{ fontSize: 13 }}>
                    El backend devuelve el codigo una sola vez y envia el correo automaticamente.
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-7">
              <div className="card">
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                    <div>
                      <h5 className="card-title mb-0">Historico de invitaciones</h5>
                      <div className="small text-muted">Total: {invTotal}</div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 105 }}
                        value={invLimit}
                        onChange={(e) => loadInvitations(invEmail.trim().toLowerCase(), 0, Number(e.target.value))}
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => loadInvitations(invEmail.trim().toLowerCase(), invOffset, invLimit)}>
                        Recargar
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>ID</th>
                          <th>Email</th>
                          <th style={{ width: 170 }}>Creada</th>
                          <th style={{ width: 170 }}>Expira</th>
                          <th style={{ width: 140 }}>Usada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invLoading ? (
                          <tr><td colSpan={5} className="text-muted">Cargando...</td></tr>
                        ) : invRows.length === 0 ? (
                          <tr><td colSpan={5} className="text-muted">Sin registros</td></tr>
                        ) : (
                          invRows.map((r) => (
                            <tr key={r.id_invitation}>
                              <td>{r.id_invitation}</td>
                              <td>{r.email}</td>
                              <td>{fmtDate(r.created_at)}</td>
                              <td>{fmtDate(r.expires_at)}</td>
                              <td>{r.used_at ? <span className="badge bg-success">Si</span> : <span className="badge bg-secondary">No</span>}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
                    <span className="small text-muted">Mostrando {invPage.from}-{invPage.to} de {invTotal}</span>
                    <div className="d-flex align-items-center gap-2">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        disabled={!invPage.canPrev || invLoading}
                        onClick={() => loadInvitations(invEmail.trim().toLowerCase(), Math.max(0, invOffset - invLimit), invLimit)}
                      >
                        Anterior
                      </button>
                      <span className="small text-muted">Pagina {invPage.page} de {invPage.pages}</span>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        disabled={!invPage.canNext || invLoading}
                        onClick={() => loadInvitations(invEmail.trim().toLowerCase(), invOffset + invLimit, invLimit)}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default OnboardingPage;