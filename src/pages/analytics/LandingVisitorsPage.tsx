import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../../layout/PageLayout';
import {
  getLandingVisitsSummary,
  type LandingVisitsDailyItem,
  type LandingVisitsPathItem,
  type LandingVisitsSummary,
  type LandingVisitsTotals,
} from '../../api/adminAnalytics';
import '../../styles/landing-visitors.css';

const dayFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short' });
const numberFormatter = new Intl.NumberFormat('es-CO');

function fmtDay(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return dayFormatter.format(d);
}

function fmtN(value: number) {
  return numberFormatter.format(value);
}

function maxVisits(items: LandingVisitsDailyItem[]) {
  return items.reduce((acc, item) => Math.max(acc, item.visits), 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validTotals(value: unknown): LandingVisitsTotals | null {
  if (!isRecord(value)) return null;
  const visits_today = finiteNumber(value.visits_today);
  const visitors_today = finiteNumber(value.visitors_today);
  const visits_7d = finiteNumber(value.visits_7d);
  const visitors_7d = finiteNumber(value.visitors_7d);
  const visits_30d = finiteNumber(value.visits_30d);
  const visitors_30d = finiteNumber(value.visitors_30d);
  if (
    visits_today === null ||
    visitors_today === null ||
    visits_7d === null ||
    visitors_7d === null ||
    visits_30d === null ||
    visitors_30d === null
  ) return null;
  return { visits_today, visitors_today, visits_7d, visitors_7d, visits_30d, visitors_30d };
}

function normalizeDaily(items: unknown): LandingVisitsDailyItem[] | null {
  if (!Array.isArray(items)) return null;
  const rows: LandingVisitsDailyItem[] = [];
  for (const item of items) {
    if (!isRecord(item) || typeof item.day !== 'string') return null;
    const visits = finiteNumber(item.visits);
    const visitors = finiteNumber(item.visitors);
    if (visits === null || visitors === null) return null;
    rows.push({ day: item.day, visits, visitors });
  }
  return rows;
}

function normalizePaths(items: unknown): LandingVisitsPathItem[] | null {
  if (!Array.isArray(items)) return null;
  const rows: LandingVisitsPathItem[] = [];
  for (const item of items) {
    if (!isRecord(item) || typeof item.landing_path !== 'string') return null;
    const visits = finiteNumber(item.visits);
    const visitors = finiteNumber(item.visitors);
    if (visits === null || visitors === null) return null;
    rows.push({ landing_path: item.landing_path, visits, visitors });
  }
  return rows;
}

function normalizeSummary(value: LandingVisitsSummary): { summary: LandingVisitsSummary; missingTotals: boolean } {
  if (!isRecord(value)) {
    throw new Error('Respuesta malformada del servidor.');
  }
  if (value.ok !== true) {
    throw new Error(typeof value.message === 'string' && value.message.trim() ? value.message : 'La API no pudo entregar el resumen.');
  }
  if (!isRecord(value.range) || typeof value.range.from !== 'string' || typeof value.range.to !== 'string') {
    throw new Error('La respuesta no incluye el rango del resumen.');
  }
  const days = finiteNumber(value.range.days);
  if (days === null) {
    throw new Error('La respuesta no incluye un rango valido.');
  }
  const daily = normalizeDaily(value.daily);
  const paths = normalizePaths(value.paths);
  if (!daily || !paths) {
    throw new Error('La respuesta no incluye series validas de visitas.');
  }
  const totals = validTotals(value.totals);
  return {
    summary: {
      ok: true,
      range: { from: value.range.from, to: value.range.to, days },
      totals,
      daily,
      paths,
    },
    missingTotals: totals === null,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (isRecord(error) && isRecord(error.response) && isRecord(error.response.data)) {
    const data = error.response.data;
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
  }
  return 'No se pudo cargar la metrica de visitantes.';
}

function kpiValue(totals: LandingVisitsTotals | null | undefined, key: keyof LandingVisitsTotals) {
  return totals ? fmtN(totals[key]) : 'No disponible';
}

export default function LandingVisitorsPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [data, setData] = useState<LandingVisitsSummary | null>(null);

  const load = async (nextDays = days) => {
    setLoading(true);
    setError('');
    setWarning('');
    try {
      const out = await getLandingVisitsSummary(nextDays);
      const normalized = normalizeSummary(out);
      setData(normalized.summary);
      if (normalized.missingTotals) {
        setWarning('La API entrego visitas, pero no entrego totales. Los indicadores principales no estan disponibles.');
      }
      setUpdatedAt(new Date());
    } catch (loadError: unknown) {
      console.error('Landing visitors summary failed', loadError);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(days);
    // carga inicial y cambio de rango
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const topDaily = useMemo(() => maxVisits(data?.daily ?? []), [data?.daily]);

  return (
    <PageLayout
      title="Visitantes landing"
      right={
        <div className="lv-head-right">
          {updatedAt ? `Actualizado: ${updatedAt.toLocaleTimeString('es-CO')}` : 'Sin datos'}
        </div>
      }
    >
      <div className="lv-toolbar">
        <div className="lv-toolbar-left">
          <label htmlFor="lv-days" className="form-label mb-0">Rango</label>
          <select
            id="lv-days"
            className="form-select form-select-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ width: 150 }}
          >
            <option value={7}>Ultimos 7 dias</option>
            <option value={30}>Ultimos 30 dias</option>
            <option value={90}>Ultimos 90 dias</option>
          </select>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Cargando...' : 'Recargar'}
        </button>
      </div>

      {error ? (
        <div className="alert alert-danger mb-3 d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <span>{error}</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void load()} disabled={loading}>
            Reintentar
          </button>
        </div>
      ) : null}
      {warning && !error ? (
        <div className="alert alert-warning mb-3">{warning}</div>
      ) : null}

      <div className="lv-kpi-grid">
        <article className="lv-kpi-card">
          <div className="lv-kpi-label">Hoy</div>
          <div className="lv-kpi-value">{kpiValue(data?.totals, 'visitors_today')}</div>
          <div className="lv-kpi-sub">personas unicas</div>
          <div className="lv-kpi-alt">{data?.totals ? `${fmtN(data.totals.visits_today)} visitas` : 'Totales no disponibles'}</div>
        </article>

        <article className="lv-kpi-card">
          <div className="lv-kpi-label">7 dias</div>
          <div className="lv-kpi-value">{kpiValue(data?.totals, 'visitors_7d')}</div>
          <div className="lv-kpi-sub">personas unicas</div>
          <div className="lv-kpi-alt">{data?.totals ? `${fmtN(data.totals.visits_7d)} visitas` : 'Totales no disponibles'}</div>
        </article>

        <article className="lv-kpi-card">
          <div className="lv-kpi-label">30 dias</div>
          <div className="lv-kpi-value">{kpiValue(data?.totals, 'visitors_30d')}</div>
          <div className="lv-kpi-sub">personas unicas</div>
          <div className="lv-kpi-alt">{data?.totals ? `${fmtN(data.totals.visits_30d)} visitas` : 'Totales no disponibles'}</div>
        </article>
      </div>

      <div className="lv-grid">
        <section className="lv-panel">
          <header className="lv-panel-head">
            <h3>Serie diaria</h3>
            <span>
              {data ? `${data.range.from} a ${data.range.to}` : '-'}
            </span>
          </header>

          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Fecha</th>
                  <th>Visitas</th>
                  <th style={{ width: 130 }}>Personas unicas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3}>Cargando...</td></tr>
                ) : (data?.daily.length ?? 0) === 0 ? (
                  <tr><td colSpan={3}>Sin datos aun</td></tr>
                ) : (
                  data?.daily.map((row) => {
                    const width = topDaily > 0 ? Math.max(6, Math.round((row.visits / topDaily) * 100)) : 0;
                    return (
                      <tr key={row.day}>
                        <td>{fmtDay(row.day)}</td>
                        <td>
                          <div className="lv-bar-wrap">
                            <span className="lv-bar-label">{fmtN(row.visits)}</span>
                            <span className="lv-bar-track">
                              <span className="lv-bar-fill" style={{ width: `${width}%` }} />
                            </span>
                          </div>
                        </td>
                        <td>{fmtN(row.visitors)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lv-panel">
          <header className="lv-panel-head">
            <h3>Rutas de landing</h3>
            <span>Top 10</span>
          </header>

          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th style={{ width: 90 }}>Visitas</th>
                  <th style={{ width: 120 }}>Personas unicas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3}>Cargando...</td></tr>
                ) : (data?.paths.length ?? 0) === 0 ? (
                  <tr><td colSpan={3}>Sin datos aun</td></tr>
                ) : (
                  data?.paths.map((row) => (
                    <tr key={row.landing_path}>
                      <td><code>{row.landing_path}</code></td>
                      <td>{fmtN(row.visits)}</td>
                      <td>{fmtN(row.visitors)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
