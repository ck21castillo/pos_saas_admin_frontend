import { useEffect, useMemo, useState, type FormEvent } from 'react';
import PageLayout from '../../layout/PageLayout';
import { listAuditLog, type AuditLogItem } from '../../api/adminAudit';
import '../../styles/audit-log.css';

function dateText(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').replace('Z', '');
}

function compact(value?: string | null, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function parseJsonText(value?: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function prettyJson(value?: string | null) {
  const parsed = parseJsonText(value);
  if (parsed === null) return '-';
  if (typeof parsed === 'string') return parsed;
  return JSON.stringify(parsed, null, 2);
}

function actionLabel(action?: string | null) {
  const text = compact(action);
  return text.replaceAll('_', ' ');
}

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [idEmpresa, setIdEmpresa] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const page = useMemo(() => Math.floor(offset / Math.max(1, limit)) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / Math.max(1, limit))), [total, limit]);
  const fromRow = total === 0 ? 0 : offset + 1;
  const toRow = Math.min(offset + items.length, total);

  const load = async (nextOffset = offset, nextLimit = limit) => {
    setLoading(true);
    setError('');
    try {
      const out = await listAuditLog({
        q: q.trim() || undefined,
        action: action || undefined,
        id_empresa: idEmpresa.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: nextLimit,
        offset: nextOffset,
      });
      setItems(out.items ?? []);
      setActions(out.actions ?? []);
      setTotal(Number(out.total ?? 0));
      setLimit(Number(out.limit ?? nextLimit));
      setOffset(Number(out.offset ?? nextOffset));
      if ((out.items ?? []).length === 0) {
        setSelected(null);
      } else if (!selected || !(out.items ?? []).some((item) => item.id_audit === selected.id_audit)) {
        setSelected(out.items[0]);
      }
    } catch {
      setError('No se pudo cargar la auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void load(0, limit);
  };

  const clear = async () => {
    setQ('');
    setAction('');
    setIdEmpresa('');
    setFrom('');
    setTo('');
    setLoading(true);
    setError('');
    try {
      const out = await listAuditLog({ limit, offset: 0 });
      setItems(out.items ?? []);
      setActions(out.actions ?? []);
      setTotal(Number(out.total ?? 0));
      setLimit(Number(out.limit ?? limit));
      setOffset(Number(out.offset ?? 0));
      setSelected((out.items ?? [])[0] ?? null);
    } catch {
      setError('No se pudo cargar la auditoria.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout title="Auditoria" right={<span className="small text-muted">Cambios administrativos</span>}>
      <form className="audit-filters" onSubmit={submit}>
        <div className="audit-search">
          <label className="form-label small mb-1">Buscar</label>
          <input
            className="form-control form-control-sm"
            placeholder="Admin, accion, IP o ID"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <div className="audit-action">
          <label className="form-label small mb-1">Accion</label>
          <select className="form-select form-select-sm" value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">Todas</option>
            {actions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="audit-company">
          <label className="form-label small mb-1">Empresa</label>
          <input
            className="form-control form-control-sm"
            placeholder="ID"
            value={idEmpresa}
            onChange={(event) => setIdEmpresa(event.target.value.replace(/\D+/g, ''))}
          />
        </div>
        <div className="audit-date">
          <label className="form-label small mb-1">Desde</label>
          <input className="form-control form-control-sm" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="audit-date">
          <label className="form-label small mb-1">Hasta</label>
          <input className="form-control form-control-sm" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="audit-limit">
          <label className="form-label small mb-1">Mostrar</label>
          <select className="form-select form-select-sm" value={limit} onChange={(event) => void load(0, Number(event.target.value))}>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>Filtrar</button>
        <button className="btn btn-outline-secondary btn-sm" type="button" disabled={loading} onClick={clear}>Limpiar</button>
      </form>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="audit-grid">
        <section className="audit-list">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Fecha</th>
                  <th>Accion</th>
                  <th style={{ width: 170 }}>Admin</th>
                  <th style={{ width: 120 }}>Objetivo</th>
                  <th style={{ width: 120 }}>IP</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-3 text-muted">Cargando...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={6} className="py-3 text-muted">Sin registros</td></tr>
                ) : items.map((item, index) => (
                  <tr key={`${item.id_audit ?? index}-${item.created_at ?? ''}`} className={selected === item ? 'table-active' : ''}>
                    <td>{dateText(item.created_at)}</td>
                    <td><span className="audit-action-pill">{actionLabel(item.action)}</span></td>
                    <td>{compact(item.actor_email)}</td>
                    <td>{compact(item.target_type)} #{compact(item.target_id, '')}</td>
                    <td>{compact(item.ip)}</td>
                    <td className="text-end">
                      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setSelected(item)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex align-items-center justify-content-between gap-2 mt-3 flex-wrap">
            <span className="small text-muted">Mostrando {fromRow}-{toRow} de {total}</span>
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={offset <= 0 || loading} onClick={() => void load(Math.max(0, offset - limit), limit)}>Anterior</button>
              <span className="small text-muted">Pagina {page} de {pages}</span>
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={offset + limit >= total || loading} onClick={() => void load(offset + limit, limit)}>Siguiente</button>
            </div>
          </div>
        </section>

        <aside className="audit-detail">
          {!selected ? (
            <div className="text-muted">Selecciona un registro.</div>
          ) : (
            <>
              <div className="audit-detail-head">
                <div>
                  <h3>{actionLabel(selected.action)}</h3>
                  <p>{dateText(selected.created_at)} - {compact(selected.actor_email)}</p>
                </div>
              </div>

              <div className="audit-meta">
                <div><span>Objetivo</span><strong>{compact(selected.target_type)} #{compact(selected.target_id, '')}</strong></div>
                <div><span>IP</span><strong>{compact(selected.ip)}</strong></div>
                <div><span>Actor ID</span><strong>{compact(selected.actor_id)}</strong></div>
              </div>

              <div className="audit-json-grid">
                <section>
                  <h4>Antes</h4>
                  <pre>{prettyJson(selected.before_json)}</pre>
                </section>
                <section>
                  <h4>Despues</h4>
                  <pre>{prettyJson(selected.after_json)}</pre>
                </section>
              </div>

              <div className="audit-user-agent">
                <h4>User agent</h4>
                <p>{compact(selected.user_agent)}</p>
              </div>
            </>
          )}
        </aside>
      </div>
    </PageLayout>
  );
}
