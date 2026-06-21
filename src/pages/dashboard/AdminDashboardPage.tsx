import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '../../layout/PageLayout';
import MI from '../../components/MI';
import {
  getAdminDashboard,
  type AdminDashboardResponse,
  type DashboardKpis,
} from '../../api/adminDashboard';
import '../../styles/admin-dashboard.css';

const numberFmt = new Intl.NumberFormat('es-CO');

const emptyKpis: DashboardKpis = {
  empresas_activas: 0,
  empresas_inactivas: 0,
  solicitudes_pendientes: 0,
  tickets_abiertos: 0,
  tenants_advertencia: 0,
  visitas_hoy: 0,
  visitas_7d: 0,
};

function n(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? numberFmt.format(num) : '0';
}

function dateText(value?: string | null) {
  if (!value) return '-';
  return value.replace('T', ' ').replace('Z', '');
}

function reasonLabel(value?: string | null) {
  if (value === 'SIN_MAPPING') return 'Sin mapping';
  if (value === 'SIN_DB_NAME') return 'Sin base asignada';
  if (value === 'MAPPING_NO_ACTIVE') return 'Mapping no activo';
  if (value === 'SIN_TABLA_TENANT') return 'Sin tabla tenant';
  return value || 'Advertencia';
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const kpis = data?.kpis ?? emptyKpis;
  const updatedAt = useMemo(() => dateText(data?.updated_at), [data?.updated_at]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const out = await getAdminDashboard();
      setData(out);
    } catch {
      setError('No se pudo cargar el dashboard administrativo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageLayout
      title="Inicio admin"
      right={(
        <div className="admin-dashboard-actions">
          <span>{data ? `Actualizado: ${updatedAt}` : 'Sin cargar'}</span>
          <button className="btn btn-outline-primary btn-sm" type="button" disabled={loading} onClick={() => void load()}>
            {loading ? 'Cargando...' : 'Recargar'}
          </button>
        </div>
      )}
    >
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <section className="admin-dashboard-kpis" aria-label="Resumen administrativo">
        <article>
          <div className="admin-dashboard-kpi-icon"><MI name="business" /></div>
          <span>Empresas activas</span>
          <strong>{n(kpis.empresas_activas)}</strong>
        </article>
        <article>
          <div className="admin-dashboard-kpi-icon muted"><MI name="business_center" /></div>
          <span>Empresas inactivas</span>
          <strong>{n(kpis.empresas_inactivas)}</strong>
        </article>
        <article>
          <div className="admin-dashboard-kpi-icon warning"><MI name="how_to_reg" /></div>
          <span>Solicitudes pendientes</span>
          <strong>{n(kpis.solicitudes_pendientes)}</strong>
        </article>
        <article>
          <div className="admin-dashboard-kpi-icon help"><MI name="support_agent" /></div>
          <span>Tickets abiertos</span>
          <strong>{n(kpis.tickets_abiertos)}</strong>
        </article>
        <article>
          <div className="admin-dashboard-kpi-icon danger"><MI name="database" /></div>
          <span>Tenants con advertencia</span>
          <strong>{n(kpis.tenants_advertencia)}</strong>
        </article>
        <article>
          <div className="admin-dashboard-kpi-icon visits"><MI name="monitoring" /></div>
          <span>Visitas 7d</span>
          <strong>{n(kpis.visitas_7d)}</strong>
          <small>Hoy: {n(kpis.visitas_hoy)}</small>
        </article>
      </section>

      <div className="admin-dashboard-grid">
        <section className="admin-dashboard-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Solicitudes pendientes</h3>
              <p>Empresas esperando revision comercial.</p>
            </div>
            <Link className="btn btn-outline-primary btn-sm" to="/onboarding">Ver todas</Link>
          </div>
          <div className="admin-dashboard-list">
            {(data?.pending_requests ?? []).length === 0 ? (
              <div className="admin-dashboard-empty">Sin solicitudes pendientes.</div>
            ) : data?.pending_requests.map((item) => (
              <div className="admin-dashboard-row" key={item.id_request}>
                <div>
                  <strong>{item.empresa_nombre || item.email}</strong>
                  <span>{item.email}</span>
                </div>
                <small>{dateText(item.created_at)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-dashboard-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Tickets abiertos</h3>
              <p>Casos de ayuda que aun requieren seguimiento.</p>
            </div>
            <Link className="btn btn-outline-primary btn-sm" to="/ayuda">Ver ayuda</Link>
          </div>
          <div className="admin-dashboard-list">
            {(data?.open_tickets ?? []).length === 0 ? (
              <div className="admin-dashboard-empty">Sin tickets abiertos.</div>
            ) : data?.open_tickets.map((item) => (
              <div className="admin-dashboard-row" key={item.id_ticket}>
                <div>
                  <strong>{item.asunto || `Ticket #${item.id_ticket}`}</strong>
                  <span>{item.empresa_nombre || item.contacto_email || 'Sin empresa'}</span>
                </div>
                <small>{item.estado || '-'}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-dashboard-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Tenants con advertencia</h3>
              <p>Mapping faltante, base sin nombre o estado no activo.</p>
            </div>
            <Link className="btn btn-outline-primary btn-sm" to="/salud-tenants">Verificar</Link>
          </div>
          <div className="admin-dashboard-list">
            {(data?.tenant_warnings ?? []).length === 0 ? (
              <div className="admin-dashboard-empty success">Sin advertencias de mapping.</div>
            ) : data?.tenant_warnings.map((item) => (
              <div className="admin-dashboard-row" key={`${item.id_empresa}-${item.motivo}`}>
                <div>
                  <strong>{item.empresa_nombre || `Empresa ${item.id_empresa}`}</strong>
                  <span>{item.db_name || 'Sin tenant asignado'}</span>
                </div>
                <small>{reasonLabel(item.motivo)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-dashboard-panel">
          <div className="admin-dashboard-panel-head">
            <div>
              <h3>Visitas recientes</h3>
              <p>Actividad reciente en landing y registro.</p>
            </div>
            <Link className="btn btn-outline-primary btn-sm" to="/analytics/landing">Ver visitas</Link>
          </div>
          <div className="admin-dashboard-list">
            {(data?.recent_visits ?? []).length === 0 ? (
              <div className="admin-dashboard-empty">Sin visitas recientes.</div>
            ) : data?.recent_visits.map((item) => (
              <div className="admin-dashboard-row" key={item.id_visit}>
                <div>
                  <strong>{item.landing_path || '/'}</strong>
                  <span>{item.referrer || 'Directo'}</span>
                </div>
                <small>{dateText(item.created_at)}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
