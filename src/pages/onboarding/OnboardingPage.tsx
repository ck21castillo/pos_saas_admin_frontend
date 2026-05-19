import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
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
    code?: string;
    message?: string;
    name?: string;
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
    if (e.code === 'ECONNABORTED') return 'La carga tardo demasiado. Revisa el backend e intenta recargar.';
    return e.response?.data?.error ?? e.response?.data?.message ?? e.message ?? fallback;
}

function isCanceledRequest(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const e = error as ApiErrorLike;
    return e.code === 'ERR_CANCELED' || e.name === 'CanceledError' || e.name === 'AbortError';
}

function parseRequestEstado(value: string): InvitationRequestEstado {
    if (value === 'PENDIENTE' || value === 'APROBADA' || value === 'RECHAZADA') return value;
    return 'PENDIENTE';
}

function fmtDate(s: string | null | undefined): string {
    if (!s) return '';
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

function parseEmailTemplate(value: string): InvitationEmailTemplate {
    return value === 'meta' ? 'meta' : 'cliente';
}

function templateLabel(value: InvitationEmailTemplate | string | null | undefined): string {
    return value === 'meta' ? 'Meta' : 'Cliente real';
}

function compactText(value: string | null | undefined, max = 150): string {
    const text = String(value ?? '').trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trim()}...`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function clampInt(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

const OnboardingPage: React.FC = () => {
    const [tab, setTab] = useState<'requests' | 'invitations'>('requests');

    const [reqEstado, setReqEstado] = useState<InvitationRequestEstado>('PENDIENTE');
    const [reqRows, setReqRows] = useState<InvitationRequestRow[]>([]);
    const [reqLoading, setReqLoading] = useState(false);
    const [reqError, setReqError] = useState<string | null>(null);

    const [invEmail, setInvEmail] = useState('');
    const [invDays, setInvDays] = useState(7);
    const [invTemplate, setInvTemplate] = useState<InvitationEmailTemplate>('cliente');
    const [invRows, setInvRows] = useState<InvitationRow[]>([]);
    const [invLoading, setInvLoading] = useState(false);
    const [invError, setInvError] = useState<string | null>(null);

    const [lastInvite, setLastInvite] = useState<null | {
        email: string;
        invite_code: string;
        expires_at: string;
        email_template: InvitationEmailTemplate;
        email_sent: boolean;
        email_error: string | null;
    }>(null);

    const reqAbortRef = useRef<AbortController | null>(null);
    const invAbortRef = useRef<AbortController | null>(null);
    const reqRunRef = useRef(0);
    const invRunRef = useRef(0);

    const loadRequests = useCallback(async () => {
        const runId = reqRunRef.current + 1;
        reqRunRef.current = runId;
        reqAbortRef.current?.abort();
        const controller = new AbortController();
        reqAbortRef.current = controller;

        setReqError(null);
        setReqLoading(true);
        try {
            const rows = await listInvitationRequests(reqEstado, { signal: controller.signal });
            if (runId !== reqRunRef.current) return;
            setReqRows(rows);
        } catch (error: unknown) {
            if (isCanceledRequest(error) || runId !== reqRunRef.current) return;
            setReqError(getErrorMessage(error, 'No se pudieron cargar las solicitudes'));
        } finally {
            if (runId === reqRunRef.current) {
                setReqLoading(false);
                if (reqAbortRef.current === controller) reqAbortRef.current = null;
            }
        }
    }, [reqEstado]);

    const loadInvitations = useCallback(async (email?: string) => {
        const runId = invRunRef.current + 1;
        invRunRef.current = runId;
        invAbortRef.current?.abort();
        const controller = new AbortController();
        invAbortRef.current = controller;

        setInvError(null);
        setInvLoading(true);
        try {
            const rows = await listInvitations(email, { signal: controller.signal });
            if (runId !== invRunRef.current) return;
            setInvRows(rows);
        } catch (error: unknown) {
            if (isCanceledRequest(error) || runId !== invRunRef.current) return;
            setInvError(getErrorMessage(error, 'No se pudieron cargar las invitaciones'));
        } finally {
            if (runId === invRunRef.current) {
                setInvLoading(false);
                if (invAbortRef.current === controller) invAbortRef.current = null;
            }
        }
    }, []);

    useEffect(() => {
        if (tab !== 'requests') return;
        void loadRequests();
        return () => {
            reqAbortRef.current?.abort();
        };
    }, [tab, loadRequests]);

    useEffect(() => {
        if (tab !== 'invitations') return;
        void loadInvitations();
        return () => {
            invAbortRef.current?.abort();
        };
    }, [tab, loadInvitations]);

    const reqRender = useMemo(() => reqRows, [reqRows]);
    const requestsWithMessage = useMemo(
        () => reqRender.filter((r) => String(r.mensaje ?? '').trim() !== ''),
        [reqRender]
    );
    const featuredRequests = useMemo(() => requestsWithMessage.slice(0, 3), [requestsWithMessage]);

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
        approvedNotes?: string,
        emailTemplate: InvitationEmailTemplate = invTemplate
    ) => {
        try {
            const out = await createInvitation({ email, days, email_template: emailTemplate });
            setLastInvite({
                email: out.email,
                invite_code: out.invite_code,
                expires_at: out.expires_at,
                email_template: out.email_template,
                email_sent: out.email_sent,
                email_error: out.email_error,
            });

            if (markApprovedRequestId) {
                try {
                    await updateInvitationRequest(markApprovedRequestId, {
                        estado: 'APROBADA',
                        notas: approvedNotes?.trim() || 'Invitacion generada',
                    });
                } catch {
                    // No bloquea la entrega del codigo si la invitacion ya fue creada.
                }
                await loadRequests();
            }

            if (tab === 'invitations') {
                await loadInvitations(invEmail.trim().toLowerCase() || undefined);
            }
        } catch (error: unknown) {
            alert(getErrorMessage(error, 'No se pudo generar la invitacion'));
        }
    };

    const doGenerateFromRequest = async (r: InvitationRequestRow) => {
        const safeEmail = escapeHtml(r.email);
        const safeNotes = escapeHtml(r.notas ?? '');
        const safeClientMessage = escapeHtml(r.mensaje ?? '');
        const clientMessageBlock = safeClientMessage
            ? `
                    <div class="invite-client-context">
                        <div class="invite-client-context-label">Contexto enviado por el cliente</div>
                        <div class="invite-client-context-copy">${safeClientMessage}</div>
                    </div>
                `
            : '';
        const warning = r.estado === 'RECHAZADA'
            ? '<div class="invite-warning">Esta solicitud esta RECHAZADA. Si continuas, se marcara como APROBADA.</div>'
            : '';

        const { isConfirmed, value } = await Swal.fire({
            title: 'Generar y enviar invitacion',
            html: `
                <style>
                    .invite-modal{ text-align:left; margin-top:2px; }
                    .invite-dest{
                        display:flex; align-items:center; justify-content:space-between; gap:12px;
                        background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;
                        padding:12px 14px; margin-bottom:14px;
                    }
                    .invite-dest-label{ font-size:12px; color:#64748b; margin-bottom:2px; }
                    .invite-dest-email{ font-size:14px; font-weight:700; color:#0f172a; word-break:break-all; }
                    .invite-status{
                        white-space:nowrap; font-size:12px; font-weight:700; color:#166534;
                        background:#dcfce7; border:1px solid #bbf7d0; border-radius:999px;
                        padding:5px 9px;
                    }
                    .invite-field{ margin-top:14px; }
                    .invite-label{ display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:7px; }
                    .invite-days-row{ display:grid; grid-template-columns:120px 1fr; gap:10px; align-items:center; }
                    .invite-days-row .swal2-input{
                        width:100%; height:42px; margin:0; border-radius:10px;
                        border:1px solid #cbd5e1; box-shadow:none; font-size:15px;
                    }
                    .invite-hint{ font-size:12px; color:#64748b; line-height:1.35; }
                    .invite-client-context{
                        margin-top:14px; padding:12px 14px; border-left:4px solid #2563eb;
                        background:#eff6ff; border-radius:10px; color:#1e293b;
                    }
                    .invite-client-context-label{ font-size:12px; font-weight:800; color:#1d4ed8; margin-bottom:5px; }
                    .invite-client-context-copy{ font-size:13px; line-height:1.45; white-space:pre-wrap; word-break:break-word; }
                    .invite-template-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
                    .invite-template-option{ position:relative; margin:0; cursor:pointer; }
                    .invite-template-option input{ position:absolute; opacity:0; pointer-events:none; }
                    .invite-template-card{
                        min-height:92px; border:1px solid #cbd5e1; border-radius:12px; padding:12px;
                        background:#ffffff; transition:border-color .15s ease, box-shadow .15s ease, background .15s ease;
                    }
                    .invite-template-option input:checked + .invite-template-card{
                        border-color:#2563eb; box-shadow:0 0 0 3px rgba(37,99,235,.14); background:#eff6ff;
                    }
                    .invite-template-title{ display:flex; align-items:center; justify-content:space-between; gap:8px; font-weight:800; color:#0f172a; font-size:14px; }
                    .invite-template-title span:last-child{ color:#2563eb; opacity:0; }
                    .invite-template-option input:checked + .invite-template-card .invite-template-title span:last-child{ opacity:1; }
                    .invite-template-copy{ margin-top:7px; font-size:12px; color:#64748b; line-height:1.35; }
                    .invite-notes{
                        width:100%; min-height:86px; resize:vertical; border-radius:10px; border:1px solid #cbd5e1;
                        padding:10px 12px; color:#0f172a; font-size:14px; outline:none;
                    }
                    .invite-warning{
                        margin-top:14px; padding:10px 12px; border-radius:10px; border:1px solid #fde68a;
                        background:#fffbeb; color:#92400e; font-size:12px; line-height:1.35;
                    }
                    @media (max-width:520px){
                        .invite-dest{ align-items:flex-start; flex-direction:column; }
                        .invite-days-row,.invite-template-grid{ grid-template-columns:1fr; }
                    }
                </style>
                <div class="invite-modal">
                    <div class="invite-dest">
                        <div>
                            <div class="invite-dest-label">Destino del codigo</div>
                            <div class="invite-dest-email">${safeEmail}</div>
                        </div>
                        <div class="invite-status">Envio por correo</div>
                    </div>

                    ${clientMessageBlock}

                    <div class="invite-field">
                        <label for="swal-days" class="invite-label">Vigencia</label>
                        <div class="invite-days-row">
                            <input id="swal-days" class="swal2-input" type="number" min="1" max="90" value="7" />
                            <div class="invite-hint">El codigo queda activo entre 1 y 90 dias. Luego vence automaticamente.</div>
                        </div>
                    </div>

                    <div class="invite-field">
                        <div class="invite-label">Dirigido a</div>
                        <div class="invite-template-grid">
                            <label class="invite-template-option">
                                <input type="radio" name="swal-template" value="cliente" checked />
                                <div class="invite-template-card">
                                    <div class="invite-template-title"><span>Cliente real</span><span>OK</span></div>
                                    <div class="invite-template-copy">Mensaje normal para activar la cuenta de una empresa.</div>
                                </div>
                            </label>
                            <label class="invite-template-option">
                                <input type="radio" name="swal-template" value="meta" />
                                <div class="invite-template-card">
                                    <div class="invite-template-title"><span>Meta</span><span>OK</span></div>
                                    <div class="invite-template-copy">Mensaje de prueba para revision o validacion externa.</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="invite-field">
                        <label for="swal-notas" class="invite-label">Notas internas opcionales</label>
                        <textarea id="swal-notas" class="invite-notes" rows="3">${safeNotes}</textarea>
                    </div>
                    ${warning}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Generar y enviar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563eb',
            focusConfirm: false,
            preConfirm: () => {
                const notas = (document.getElementById('swal-notas') as HTMLTextAreaElement | null)?.value ?? '';
                const rawDays = (document.getElementById('swal-days') as HTMLInputElement | null)?.value ?? '7';
                const daysParsed = parseInt(String(rawDays), 10);
                const rawTemplate = document.querySelector<HTMLInputElement>('input[name="swal-template"]:checked')?.value ?? 'cliente';
                const emailTemplate = parseEmailTemplate(rawTemplate);
                const days = clampInt(Number.isFinite(daysParsed) ? daysParsed : 7, 1, 90);

                if (!Number.isFinite(daysParsed) || String(rawDays).trim() === '') {
                    Swal.showValidationMessage('Ingresa un numero de dias valido (1 a 90).');
                    return;
                }

                return { notas, days, emailTemplate };
            },
        });

        if (!isConfirmed || !value) return;
        await doCreateInviteForEmail(r.email, value.days, r.id_request, value.notas, value.emailTemplate);
    };

    const copyLastInvite = async () => {
        if (!lastInvite?.invite_code) return;
        try {
            await navigator.clipboard.writeText(lastInvite.invite_code);
            alert('Copiado');
        } catch {
            window.prompt('Copia el codigo:', lastInvite.invite_code);
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
                                <div className="fw-bold">Codigo generado (mostrar/copiar una sola vez)</div>
                                <div className="text-muted" style={{ fontSize: 13 }}>
                                    Email: <span className="text-light">{lastInvite.email}</span> - Plantilla: {templateLabel(lastInvite.email_template)} - Expira: {fmtDate(lastInvite.expires_at)}
                                </div>
                                <div className="mt-2">
                                    {lastInvite.email_sent ? (
                                        <span className="badge bg-success">Correo enviado</span>
                                    ) : (
                                        <span className="badge bg-warning text-dark">Correo no enviado</span>
                                    )}
                                </div>
                                {lastInvite.email_error && (
                                    <div className="text-warning mt-2" style={{ fontSize: 13 }}>La invitacion se creo, pero fallo el envio por correo.</div>
                                )}
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
                                Tip: "Generar y enviar" aprueba, genera la invitacion y manda el correo. El codigo solo se muestra una vez.
                            </div>
                        </div>

                        {requestsWithMessage.length > 0 && (
                            <div className="onboarding-signal-strip mb-3">
                                <div className="onboarding-signal-summary">
                                    <div className="onboarding-signal-kicker">Contexto del formulario</div>
                                    <div className="onboarding-signal-title">
                                        {requestsWithMessage.length} solicitud{requestsWithMessage.length === 1 ? '' : 'es'} con mensaje adicional
                                    </div>
                                </div>
                                <div className="onboarding-signal-list">
                                    {featuredRequests.map((r) => (
                                        <button
                                            key={r.id_request}
                                            className="onboarding-signal-item"
                                            type="button"
                                            onClick={() => doGenerateFromRequest(r)}
                                        >
                                            <span className="onboarding-signal-email">{r.email}</span>
                                            <span className="onboarding-signal-message">{compactText(r.mensaje, 110)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                        <th style={{ minWidth: 260 }}>Contexto</th>
                                        <th style={{ width: 130 }}>Estado</th>
                                        <th style={{ width: 170 }}>Fecha</th>
                                        <th style={{ width: 280 }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reqLoading ? (
                                        <tr>
                                            <td colSpan={9} className="text-muted">
                                                Cargando...
                                            </td>
                                        </tr>
                                    ) : reqRender.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-muted">
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
                                                <td>
                                                    <div>{r.empresa_nombre ?? <span className="text-muted">-</span>}</div>
                                                </td>
                                                <td>{r.telefono || <span className="text-muted">-</span>}</td>
                                                <td>{planLabel(r.plan_solicitado)}</td>
                                                <td>
                                                    {r.mensaje ? (
                                                        <div className="onboarding-message-box">
                                                            <div className="onboarding-message-label">Mensaje adicional</div>
                                                            <div className="onboarding-message-copy">{r.mensaje}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted">Sin mensaje</span>
                                                    )}
                                                </td>
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
                                    <select
                                        className="form-select"
                                        value={invTemplate}
                                        onChange={(e) => setInvTemplate(parseEmailTemplate(e.target.value))}
                                    >
                                        <option value="cliente">Cliente real</option>
                                        <option value="meta">Meta</option>
                                    </select>
                                </div>

                                <div className="d-flex gap-2">
                                    <button
                                        className="btn btn-primary"
                                        type="button"
                                        disabled={invLoading || !invEmail.trim()}
                                        onClick={() => doCreateInviteForEmail(invEmail.trim().toLowerCase(), invDays, undefined, undefined, invTemplate)}
                                    >
                                        Generar y enviar
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
                                    Nota: el backend devuelve el codigo una sola vez y envia el correo automaticamente.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-12 col-lg-7">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <h5 className="card-title mb-0">Historico de invitaciones</h5>
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
                                                            {r.used_at ? <span className="badge bg-success">Si</span> : <span className="badge bg-secondary">No</span>}
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
