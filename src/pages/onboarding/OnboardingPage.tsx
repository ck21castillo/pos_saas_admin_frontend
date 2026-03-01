import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
    createInvitation,
    listInvitationRequests,
    listInvitations,
    type InvitationRequestEstado,
    type InvitationRequestRow,
    type InvitationRow,
    updateInvitationRequest,
} from '../../api/adminOnboarding';

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

function fmtDate(s: string | null | undefined): string {
    if (!s) return '';
    return s.replace('T', ' ').replace('Z', '');
}

function clampInt(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

const OnboardingPage: React.FC = () => {
    const [tab, setTab] = useState<'requests' | 'invitations'>('requests');

    // Solicitudes
    const [reqEstado, setReqEstado] = useState<InvitationRequestEstado>('PENDIENTE');
    const [reqRows, setReqRows] = useState<InvitationRequestRow[]>([]);
    const [reqLoading, setReqLoading] = useState(false);
    const [reqError, setReqError] = useState<string | null>(null);

    // Invitaciones
    const [invEmail, setInvEmail] = useState('');
    const [invDays, setInvDays] = useState(7);
    const [invRows, setInvRows] = useState<InvitationRow[]>([]);
    const [invLoading, setInvLoading] = useState(false);
    const [invError, setInvError] = useState<string | null>(null);

    const [lastInvite, setLastInvite] = useState<null | {
        email: string;
        invite_code: string;
        expires_at: string;
    }>(null);

    const loadRequests = async () => {
        setReqError(null);
        setReqLoading(true);
        try {
            const rows = await listInvitationRequests(reqEstado);
            setReqRows(rows);
        } catch (error: unknown) {
            setReqError(getErrorMessage(error, 'No se pudieron cargar las solicitudes'));
        } finally {
            setReqLoading(false);
        }
    };

    const loadInvitations = async (email?: string) => {
        setInvError(null);
        setInvLoading(true);
        try {
            const rows = await listInvitations(email);
            setInvRows(rows);
        } catch (error: unknown) {
            setInvError(getErrorMessage(error, 'No se pudieron cargar las invitaciones'));
        } finally {
            setInvLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'requests') loadRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, reqEstado]);

    useEffect(() => {
        if (tab === 'invitations') loadInvitations(invEmail.trim().toLowerCase() || undefined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const reqRender = useMemo(() => reqRows, [reqRows]);

    const doReject = async (r: InvitationRequestRow) => {
        const notas = window.prompt('Notas (opcional) para rechazar:', r.notas ?? '') ?? '';
        try {
            await updateInvitationRequest(r.id_request, { estado: 'RECHAZADA', notas });
            await loadRequests();
        } catch (error: unknown) {
            alert(getErrorMessage(error, 'No se pudo rechazar'));
        }
    };

    const doCreateInviteForEmail = async (
        email: string,
        days = 7,
        markApprovedRequestId?: number,
        approvedNotes?: string
    ) => {
        try {
            const out = await createInvitation({ email, days });
            setLastInvite({ email: out.email, invite_code: out.invite_code, expires_at: out.expires_at });

            // Marcar solicitud como APROBADA (aprobaciÃ³n real = invitaciÃ³n generada)
            if (markApprovedRequestId) {
                try {
                    await updateInvitationRequest(markApprovedRequestId, {
                        estado: 'APROBADA',
                        notas: approvedNotes?.trim() || 'InvitaciÃ³n generada',
                    });
                } catch {
                    // no bloquea
                }
                await loadRequests();
            }

            if (tab === 'invitations') {
                await loadInvitations(invEmail.trim().toLowerCase() || undefined);
            }
        } catch (error: unknown) {
            alert(getErrorMessage(error, 'No se pudo generar la invitación'));
        }
    };
    const doGenerateFromRequest = async (r: InvitationRequestRow) => {
        const warning = r.estado === 'RECHAZADA'
            ? '<div style="font-size:12px;color:#f59e0b;margin-top:8px;">Esta solicitud está RECHAZADA. Si continúas, se marcará como APROBADA.</div>'
            : '';

        const { isConfirmed, value } = await Swal.fire({
            title: 'Aprobar y generar código',
            html: `
                <div style="text-align:left">
                    <label for="swal-notas" style="display:block;margin-bottom:6px;">Notas (opcional) para aprobar/generar código:</label>
                    <textarea id="swal-notas" class="swal2-textarea" style="width:100%;margin:0 0 12px 0;resize:vertical;" rows="3">${r.notas ?? ''}</textarea>
                    <label for="swal-days" style="display:block;margin-bottom:6px;">Días de vigencia del código (1 a 90):</label>
                    <input id="swal-days" class="swal2-input" type="number" min="1" max="90" value="7" style="width:100%;margin:0;" />
                    ${warning}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Aceptar',
            cancelButtonText: 'Cancelar',
            focusConfirm: false,
            preConfirm: () => {
                const notas = (document.getElementById('swal-notas') as HTMLTextAreaElement | null)?.value ?? '';
                const rawDays = (document.getElementById('swal-days') as HTMLInputElement | null)?.value ?? '7';
                const daysParsed = parseInt(String(rawDays), 10);
                const days = clampInt(Number.isFinite(daysParsed) ? daysParsed : 7, 1, 90);

                if (!Number.isFinite(daysParsed) || String(rawDays).trim() === '') {
                    Swal.showValidationMessage('Ingresa un número de días válido (1 a 90).');
                    return;
                }

                return { notas, days };
            },
        });

        if (!isConfirmed || !value) return;
        await doCreateInviteForEmail(r.email, value.days, r.id_request, value.notas);
    };

    const copyLastInvite = async () => {
        if (!lastInvite?.invite_code) return;
        try {
            await navigator.clipboard.writeText(lastInvite.invite_code);
            alert('Copiado âœ…');
        } catch {
            window.prompt('Copia el cÃ³digo:', lastInvite.invite_code);
        }
    };

    return (
        <div className="container py-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                    <h3 className="mb-0">Onboarding</h3>
                    <div className="text-muted">Solicitudes e invitaciones de registro</div>
                </div>
            </div>

            <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                    <button
                        className={`nav-link ${tab === 'requests' ? 'active' : ''}`}
                        onClick={() => setTab('requests')}
                        type="button"
                    >
                        Solicitudes
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${tab === 'invitations' ? 'active' : ''}`}
                        onClick={() => setTab('invitations')}
                        type="button"
                    >
                        Invitaciones
                    </button>
                </li>
            </ul>

            {lastInvite && (
                <div className="card mb-3">
                    <div className="card-body">
                        <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between">
                            <div>
                                <div className="fw-bold">CÃ³digo generado (mostrar/copy una sola vez)</div>
                                <div className="text-muted" style={{ fontSize: 13 }}>
                                    Email: <span className="text-light">{lastInvite.email}</span> Â· Expira: {fmtDate(lastInvite.expires_at)}
                                </div>
                                <div
                                    className="mt-2"
                                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
                                >
                                    {lastInvite.invite_code}
                                </div>
                            </div>
                            <div className="d-flex gap-2">
                                <button className="btn btn-primary" onClick={copyLastInvite} type="button">
                                    Copiar
                                </button>
                                <button className="btn btn-outline-secondary" onClick={() => setLastInvite(null)} type="button">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {tab === 'requests' && (
                <div className="card">
                    <div className="card-body">
                        <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                            <div className="d-flex gap-2 align-items-center">
                                <span className="text-muted">Estado:</span>
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: 160 }}
                                    value={reqEstado}
                                    onChange={(e) => setReqEstado(parseRequestEstado(e.target.value))}
                                >
                                    <option value="PENDIENTE">PENDIENTE</option>
                                    <option value="APROBADA">APROBADA</option>
                                    <option value="RECHAZADA">RECHAZADA</option>
                                </select>
                                <button className="btn btn-sm btn-outline-secondary" type="button" onClick={loadRequests}>
                                    Recargar
                                </button>
                            </div>

                            <div className="text-muted" style={{ fontSize: 13 }}>
                                Tip: â€œGenerar cÃ³digoâ€ aprueba + genera invitaciÃ³n (el cÃ³digo solo se muestra una vez).
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
                                        <th style={{ width: 130 }}>Estado</th>
                                        <th style={{ width: 170 }}>Fecha</th>
                                        <th style={{ width: 280 }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reqLoading ? (
                                        <tr>
                                            <td colSpan={6} className="text-muted">
                                                Cargando...
                                            </td>
                                        </tr>
                                    ) : reqRender.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-muted">
                                                Sin resultados
                                            </td>
                                        </tr>
                                    ) : (
                                        reqRender.map((r) => (
                                            <tr key={r.id_request}>
                                                <td>{r.id_request}</td>
                                                <td>
                                                    <div className="fw-semibold">{r.email}</div>
                                                    {r.ip && (
                                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                                            {r.ip}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>{r.empresa_nombre ?? <span className="text-muted">â€”</span>}</td>
                                                <td>
                                                    <span
                                                        className={
                                                            r.estado === 'PENDIENTE'
                                                                ? 'badge bg-warning text-dark'
                                                                : r.estado === 'APROBADA'
                                                                    ? 'badge bg-success'
                                                                    : 'badge bg-danger'
                                                        }
                                                    >
                                                        {r.estado}
                                                    </span>
                                                </td>
                                                <td>{fmtDate(r.created_at)}</td>
                                                <td>
                                                    <div className="d-flex flex-wrap gap-2">
                                                        <button
                                                            className="btn btn-sm btn-outline-danger"
                                                            type="button"
                                                            onClick={() => doReject(r)}
                                                            disabled={r.estado === 'RECHAZADA'}
                                                        >
                                                            Rechazar
                                                        </button>

                                                        <button
                                                            className="btn btn-sm btn-primary"
                                                            type="button"
                                                            onClick={() => doGenerateFromRequest(r)}
                                                        >
                                                            Generar cÃ³digo
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
            )}

            {tab === 'invitations' && (
                <div className="row g-3">
                    <div className="col-12 col-lg-5">
                        <div className="card">
                            <div className="card-body">
                                <h5 className="card-title mb-3">Generar invitaciÃ³n</h5>

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
                                    <label className="form-label">DÃ­as de vigencia</label>
                                    <input
                                        className="form-control"
                                        value={String(invDays)}
                                        onChange={(e) => setInvDays(clampInt(parseInt(e.target.value || '7', 10) || 7, 1, 90))}
                                        type="number"
                                        min={1}
                                    />
                                </div>

                                <div className="d-flex gap-2">
                                    <button
                                        className="btn btn-primary"
                                        type="button"
                                        disabled={invLoading || !invEmail.trim()}
                                        onClick={() => doCreateInviteForEmail(invEmail.trim().toLowerCase(), invDays)}
                                    >
                                        Generar
                                    </button>

                                    <button
                                        className="btn btn-outline-secondary"
                                        type="button"
                                        disabled={invLoading}
                                        onClick={() => loadInvitations(invEmail.trim().toLowerCase() || undefined)}
                                    >
                                        Buscar
                                    </button>
                                </div>

                                <div className="text-muted mt-3" style={{ fontSize: 13 }}>
                                    Nota: el backend devuelve el cÃ³digo una sola vez. Si lo pierdes, genera una nueva invitaciÃ³n.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-lg-7">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <h5 className="card-title mb-0">HistÃ³rico de invitaciones</h5>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        type="button"
                                        onClick={() => loadInvitations(invEmail.trim().toLowerCase() || undefined)}
                                    >
                                        Recargar
                                    </button>
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
                                                <tr>
                                                    <td colSpan={5} className="text-muted">
                                                        Cargando...
                                                    </td>
                                                </tr>
                                            ) : invRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="text-muted">
                                                        Sin registros
                                                    </td>
                                                </tr>
                                            ) : (
                                                invRows.map((r) => (
                                                    <tr key={r.id_invitation}>
                                                        <td>{r.id_invitation}</td>
                                                        <td>{r.email}</td>
                                                        <td>{fmtDate(r.created_at)}</td>
                                                        <td>{fmtDate(r.expires_at)}</td>
                                                        <td>
                                                            {r.used_at ? <span className="badge bg-success">SÃ­</span> : <span className="badge bg-secondary">No</span>}
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
            )}
        </div>
    );
};

export default OnboardingPage;


