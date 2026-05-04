import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../../layout/PageLayout';
import {
  getLandingVisitsSummary,
  type LandingVisitsDailyItem,
  type LandingVisitsSummary,
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

export default function LandingVisitorsPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [data, setData] = useState<LandingVisitsSummary | null>(null);

  const load = async (nextDays = days) => {
    setLoading(true);
    setError('');
    try {
      const out = await getLandingVisitsSummary(nextDays);
      setData(out);
      setUpdatedAt(new Date());
    } catch {
      setError('No se pudo cargar la métrica de visitantes.');
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
            style={{ width: 140 }}
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
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
        <div className="alert alert-danger mb-3">{error}</div>
      ) : null}

      <div className="lv-kpi-grid">
        <article className="lv-kpi-card">
          <div className="lv-kpi-label">Hoy</div>
          <div className="lv-kpi-value">{fmtN(data?.totals.visitors_today ?? 0)}</div>
          <div className="lv-kpi-sub">personas únicas</div>
          <div className="lv-kpi-alt">{fmtN(data?.totals.visits_today ?? 0)} visitas</div>
        </article>

        <article className="lv-kpi-card">
          <div className="lv-kpi-label">7 días</div>
          <div className="lv-kpi-value">{fmtN(data?.totals.visitors_7d ?? 0)}</div>
          <div className="lv-kpi-sub">personas únicas</div>
          <div className="lv-kpi-alt">{fmtN(data?.totals.visits_7d ?? 0)} visitas</div>
        </article>

        <article className="lv-kpi-card">
          <div className="lv-kpi-label">30 días</div>
          <div className="lv-kpi-value">{fmtN(data?.totals.visitors_30d ?? 0)}</div>
          <div className="lv-kpi-sub">personas únicas</div>
          <div className="lv-kpi-alt">{fmtN(data?.totals.visits_30d ?? 0)} visitas</div>
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
                  <th style={{ width: 130 }}>Personas únicas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3}>Cargando...</td></tr>
                ) : (data?.daily.length ?? 0) === 0 ? (
                  <tr><td colSpan={3}>Sin datos aún</td></tr>
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
                  <th style={{ width: 120 }}>Personas únicas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3}>Cargando...</td></tr>
                ) : (data?.paths.length ?? 0) === 0 ? (
                  <tr><td colSpan={3}>Sin datos aún</td></tr>
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
