import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import {
  getTenantHealth,
  listTenantHealth,
  type TenantHealthItem,
  type TenantInspectionState,
  type TenantHealthStatus,
} from '../../api/adminTenantHealth';
import '../../styles/tenant-health.css';

const numberFmt = new Intl.NumberFormat('es-CO');
const moneyFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function statusClass(status: TenantHealthStatus) {
  if (status === 'PENDING') return 'badge text-bg-secondary';
  if (status === 'OK') return 'badge text-bg-success';
  if (status === 'WARNING') return 'badge text-bg-warning';
  return 'badge text-bg-danger';
}

function statusLabel(status: TenantHealthStatus) {
  if (status === 'PENDING') return 'Sin verificacion';
  if (status === 'OK') return 'OK';
  if (status === 'WARNING') return 'Alerta';
  return 'Error';
}

function inspectionClass(state?: TenantInspectionState | null) {
  if (state === 'FRESH') return 'badge text-bg-success';
  if (state === 'STALE') return 'badge text-bg-warning';
  return 'badge text-bg-light border text-dark';
}

function inspectionLabel(state?: TenantInspectionState | null) {
  if (state === 'FRESH') return 'Vigente';
  if (state === 'STALE') return 'Vencida';
  return 'Aun sin verificacion';
}

function n(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? numberFmt.format(num) : '0';
}

function money(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? moneyFmt.format(num) : '$ 0';
}

function dateText(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').replace('Z', '');
}

export default function TenantHealthPage() {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ ok: 0, warning: 0, error: 0, pending: 0 });
  const [items, setItems] = useState<TenantHealthItem[]>([]);
  const [selected, setSelected] = useState<TenantHealthItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<number | null>(null);
  const [deepLoadingId, setDeepLoadingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [snapshotSupported, setSnapshotSupported] = useState(true);
  const [snapshotTtlSeconds, setSnapshotTtlSeconds] = useState<number | null>(null);

  const page = useMemo(() => Math.floor(offset / Math.max(1, limit)) + 1, [offset, limit]);
  const pages = useMemo(() => Math.max(1, Math.ceil(total / Math.max(1, limit))), [total, limit]);
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + items.length, total);

  const updateLocalItem = useCallback((item: TenantHealthItem) => {
    setSelected(item);
    setItems((prev) => prev.map((row) => (row.id_empresa === item.id_empresa ? item : row)));
    setUpdatedAt(new Date());
  }, []);

  const load = async (nextOffset = offset, nextLimit = limit, nextQ = q) => {
    setLoading(true);
    setError('');
    try {
      const out = await listTenantHealth({ q: nextQ.trim() || undefined, limit: nextLimit, offset: nextOffset });
      setItems(out.items ?? []);
      setTotal(Number(out.total ?? 0));
      setLimit(Number(out.limit ?? nextLimit));
      setOffset(Number(out.offset ?? nextOffset));
      setSummary({
        ok: Number(out.summary?.ok ?? 0),
        warning: Number(out.summary?.warning ?? 0),
        error: Number(out.summary?.error ?? 0),
        pending: Number(out.summary?.pending ?? 0),
      });
      setSnapshotSupported(Boolean(out.snapshot_supported ?? true));
      setSnapshotTtlSeconds(typeof out.snapshot_ttl_seconds === 'number' ? out.snapshot_ttl_seconds : null);
      setUpdatedAt(new Date());
      if (out.items.length === 0) {
        setSelected(null);
      } else if (selected) {
        setSelected((current) => {
          if (!current) return current;
          return (out.items ?? []).find((item) => item.id_empresa === current.id_empresa) ?? current;
        });
      }
    } catch {
      setError('No se pudo cargar la salud multibase.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (item: TenantHealthItem) => {
    setSelected(item);
    setDetailLoadingId(item.id_empresa);
    setError('');
    try {
      const out = await getTenantHealth(item.id_empresa, false);
      updateLocalItem(out.item);
    } catch {
      setError('No se pudo verificar el tenant seleccionado.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const runDeepDiagnostic = async (item: TenantHealthItem) => {
    const answer = await Swal.fire({
      icon: 'question',
      title: 'Diagnostico profundo',
      text: 'Esta revision puede tardar mas porque consulta informacion adicional del tenant.',
      showCancelButton: true,
      confirmButtonText: 'Ejecutar diagnostico',
      cancelButtonText: 'Cancelar',
    });
    if (!answer.isConfirmed) return;

    setDeepLoadingId(item.id_empresa);
    setError('');
    try {
      const out = await getTenantHealth(item.id_empresa, true);
      updateLocalItem(out.item);
      const icon = out.item.health_status === 'OK'
        ? 'success'
        : out.item.health_status === 'WARNING' || out.item.health_status === 'PENDING'
          ? 'warning'
          : 'error';
      await Swal.fire({
        icon,
        title: `Resultado: ${statusLabel(out.item.health_status)}`,
        text: out.item.errors?.[0] || out.item.warnings?.[0] || 'Tenant verificado correctamente.',
        confirmButtonText: 'Entendido',
      });
    } catch {
      setError('No se pudo ejecutar el diagnostico profundo.');
      await Swal.fire('Error', 'No se pudo ejecutar el diagnostico profundo.', 'error');
    } finally {
      setDeepLoadingId(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void load(0, limit, q);
  };

  return (
    <PageLayout
      title="Salud multibase"
      right={<span className="small text-muted">{updatedAt ? `Actualizado: ${updatedAt.toLocaleTimeString('es-CO')}` : 'Sin revisar'}</span>}
    >
      <div className="tenant-health-toolbar">
        <form className="tenant-health-filters" onSubmit={onSubmit}>
          <div className="tenant-search">
            <label className="form-label small mb-1">Buscar</label>
            <input
              className="form-control form-control-sm"
              placeholder="Empresa, NIT, codigo o tenant"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="tenant-limit">
            <label className="form-label small mb-1">Mostrar</label>
            <select
              className="form-select form-select-sm"
              value={limit}
              onChange={(e) => void load(0, Number(e.target.value), q)}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>Buscar</button>
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            disabled={loading}
            onClick={() => {
              setQ('');
              void load(0, limit, '');
            }}
          >
            Limpiar
          </button>
        </form>
        <button className="btn btn-outline-primary btn-sm" type="button" disabled={loading} onClick={() => void load(offset, limit, q)}>
          {loading ? 'Revisando...' : 'Recargar'}
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {!snapshotSupported ? (
        <div className="alert alert-warning py-2">
          El resumen aun no esta preparado para guardar verificaciones. Puedes abrir el detalle de una empresa para revisarla puntualmente.
        </div>
      ) : null}

      <div className="tenant-kpis">
        <article><span>OK</span><strong>{n(summary.ok)}</strong></article>
        <article><span>Alertas</span><strong>{n(summary.warning)}</strong></article>
        <article><span>Errores</span><strong>{n(summary.error)}</strong></article>
        <article><span>Pendientes</span><strong>{n(summary.pending)}</strong></article>
        <article><span>Total empresas</span><strong>{n(total)}</strong></article>
      </div>

      <div className="tenant-grid">
        <section className="tenant-list">
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>ID</th>
                  <th>Empresa</th>
                  <th>Tenant</th>
                  <th style={{ width: 110 }}>Salud</th>
                  <th style={{ width: 90 }}>Tamano</th>
                  <th style={{ width: 90 }}>Ventas 30d</th>
                  <th style={{ width: 125 }}>Snapshot</th>
                  <th style={{ width: 145 }}>Ultima verificacion</th>
                  <th style={{ width: 80 }}>Ms</th>
                  <th style={{ width: 110 }} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="py-3 text-muted">Cargando...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={10} className="py-3 text-muted">Sin resultados</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id_empresa} className={selected?.id_empresa === item.id_empresa ? 'table-active' : ''}>
                    <td>{item.id_empresa}</td>
                    <td>
                      <button type="button" className="tenant-link" onClick={() => void openDetail(item)}>
                        {item.empresa_nombre || `Empresa ${item.id_empresa}`}
                      </button>
                      <div className="small text-muted">{item.tipo_negocio || 'GENERAL'}</div>
                    </td>
                    <td>
                      <code>{item.tenant?.db_name || '-'}</code>
                      <div className="small text-muted">{item.tenant?.estado || 'SIN_MAPPING'}</div>
                    </td>
                    <td><span className={statusClass(item.health_status)}>{statusLabel(item.health_status)}</span></td>
                    <td>{item.db_size || '-'}</td>
                    <td>{n(item.recent?.ventas_30d)}</td>
                    <td>
                      <span className={inspectionClass(item.inspection?.state)}>
                        {inspectionLabel(item.inspection?.state)}
                      </span>
                    </td>
                    <td className="small text-muted">{dateText(item.inspection?.checked_at ?? item.checked_at)}</td>
                    <td>{item.check_ms ?? '-'}</td>
                    <td className="text-end">
                      <button className="btn btn-outline-primary btn-sm" type="button" disabled={detailLoadingId === item.id_empresa} onClick={() => void openDetail(item)}>
                        {detailLoadingId === item.id_empresa ? 'Abriendo...' : 'Detalle'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex align-items-center justify-content-between gap-2 mt-3 flex-wrap">
            <span className="small text-muted">Mostrando {from}-{to} de {total}</span>
            <div className="d-flex align-items-center gap-2">
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={offset <= 0 || loading} onClick={() => void load(Math.max(0, offset - limit), limit, q)}>Anterior</button>
              <span className="small text-muted">Pagina {page} de {pages}</span>
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={offset + limit >= total || loading} onClick={() => void load(offset + limit, limit, q)}>Siguiente</button>
            </div>
          </div>
        </section>

        <aside className="tenant-detail">
          {!selected ? (
            <div className="text-muted">Selecciona una empresa para ver el detalle.</div>
          ) : (
            <>
              <div className="tenant-detail-head">
                <div>
                  <h3>{selected.empresa_nombre}</h3>
                  <p>Empresa #{selected.id_empresa} - {selected.tenant?.db_name || 'sin tenant'}</p>
                </div>
                <span className={statusClass(selected.health_status)}>{statusLabel(selected.health_status)}</span>
              </div>

              <div className="d-flex flex-wrap gap-2 mb-3">
                <button className="btn btn-outline-primary btn-sm" type="button" disabled={detailLoadingId === selected.id_empresa} onClick={() => void openDetail(selected)}>
                  {detailLoadingId === selected.id_empresa ? 'Actualizando...' : 'Actualizar detalle rapido'}
                </button>
                <button className="btn btn-outline-secondary btn-sm" type="button" disabled={deepLoadingId === selected.id_empresa} onClick={() => void runDeepDiagnostic(selected)}>
                  {deepLoadingId === selected.id_empresa ? 'Diagnosticando...' : 'Diagnostico profundo'}
                </button>
              </div>

              {selected.inspection?.persisted === false ? (
                <div className="alert alert-warning py-2">
                  La verificacion se completo, pero no pudo guardarse como instantanea para el resumen.
                </div>
              ) : null}
              <div className="alert alert-light border py-2 small">
                Estado del resumen: <b>{inspectionLabel(selected.inspection?.state)}</b>
                {' '} / Origen: <b>{selected.inspection?.source || '-'}</b>
                {' '} / Ultima verificacion: <b>{dateText(selected.inspection?.checked_at ?? selected.checked_at)}</b>
                {selected.inspection?.source === 'DIRECT' ? <> / Profundo: <b>{selected.inspection.deep ? 'Si' : 'No'}</b></> : null}
                {snapshotTtlSeconds ? <> / TTL: <b>{n(snapshotTtlSeconds)}s</b></> : null}
              </div>

              <div className="tenant-detail-grid">
                <div><span>Conexion</span><strong>{selected.connection_ms ?? '-'} ms</strong></div>
                <div><span>Chequeo</span><strong>{selected.check_ms ?? '-'} ms</strong></div>
                <div><span>Tamano</span><strong>{selected.db_size || '-'}</strong></div>
                <div><span>Ventas 30d</span><strong>{n(selected.recent?.ventas_30d)}</strong></div>
                <div><span>Total ventas 30d</span><strong>{money(selected.recent?.total_ventas_30d)}</strong></div>
                <div><span>Compras 30d</span><strong>{n(selected.recent?.compras_30d)}</strong></div>
              </div>

              <div className="tenant-detail-section">
                <h4>Alertas y errores</h4>
                {(selected.errors?.length ?? 0) === 0 && (selected.warnings?.length ?? 0) === 0 ? (
                  <div className="alert alert-success py-2 mb-0">Sin alertas basicas.</div>
                ) : (
                  <div className="tenant-alert-list">
                    {selected.errors?.map((msg, idx) => <div className="alert alert-danger py-2" key={`e-${idx}`}>{msg}</div>)}
                    {selected.warnings?.map((msg, idx) => <div className="alert alert-warning py-2" key={`w-${idx}`}>{msg}</div>)}
                  </div>
                )}
              </div>

              <div className="tenant-detail-section">
                <h4>Conteos clave</h4>
                <div className="tenant-counts">
                  <span>Productos <strong>{n(selected.counts?.producto)}</strong></span>
                  <span>Inventario <strong>{n(selected.counts?.inventario)}</strong></span>
                  <span>Ventas <strong>{n(selected.counts?.venta)}</strong></span>
                  <span>Detalle venta <strong>{n(selected.counts?.venta_detalle)}</strong></span>
                  <span>Compras <strong>{n(selected.counts?.compra)}</strong></span>
                  <span>Mov. inventario <strong>{n(selected.counts?.movimientos_inventario)}</strong></span>
                </div>
              </div>

              <div className="tenant-detail-section">
                <h4>Tablas mas pesadas</h4>
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead><tr><th>Tabla</th><th>Filas est.</th><th>Muertas</th><th>Tamano</th></tr></thead>
                    <tbody>
                      {(selected.top_tables ?? []).length === 0 ? (
                        <tr><td colSpan={4} className="text-muted">Sin datos</td></tr>
                      ) : selected.top_tables?.map((row) => (
                        <tr key={row.table}>
                          <td><code>{row.table}</code></td>
                          <td>{n(row.live_rows)}</td>
                          <td>{n(row.dead_rows)}</td>
                          <td>{row.total_size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="tenant-detail-section small text-muted">
                Ultima revision: {dateText(selected.inspection?.checked_at ?? selected.checked_at)}
              </div>
            </>
          )}
        </aside>
      </div>
    </PageLayout>
  );
}

