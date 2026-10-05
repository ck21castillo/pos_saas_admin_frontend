import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import SupportBlockDiagnosticModal from '../../components/SupportBlockDiagnosticModal';
import MI from '../../components/MI';
import PageLayout from '../../layout/PageLayout';
import {
  SAAS_MANAGED_CAPABILITY_ORDER,
  actualizarPlanSaas,
  crearPlanSaas,
  getPlanCapabilities,
  getPlanPublicProfile,
  isSyncPending,
  listarPlanesSaas,
  orderSaasCapabilities,
  savePlanCapabilities,
  savePlanPublicProfile,
  type SaasCapabilityBlockDiagnostic,
  type SaasManagedCapabilityCode,
  type SaasPlan,
  type SaasPlanCapability,
  type SaasPlanPublicBenefit,
  type SaveSaasPlanPublicProfilePayload,
  type SaveSaasPlanPayload,
} from '../../api/adminSaas';

const emptyPlan: SaveSaasPlanPayload = {
  codigo: '',
  nombre: '',
  descripcion: '',
  precio_mensual: 0,
  precio_anual: 0,
  usuarios_incluidos: 3,
  precio_usuario_extra_mensual: 0,
  precio_usuario_extra_anual: 0,
  whatsapp_incluido: false,
  precio_whatsapp_mensual: 0,
  precio_whatsapp_anual: 0,
  visible_publico: true,
  activo: true,
  orden: 100,
};

const inputStyle = { height: 46, borderRadius: 8 };
type EditorTab = 'comercial' | 'capacidades' | 'publica';

const emptyPublicProfile: SaveSaasPlanPublicProfilePayload = {
  landing_titulo: '',
  landing_resumen: '',
  landing_icono: '',
  landing_destacado: false,
  landing_etiqueta: '',
  landing_cta_texto: '',
  beneficios: [],
};

const CAPABILITY_FALLBACKS: Record<SaasManagedCapabilityCode, Omit<SaasPlanCapability, 'incluida'>> = {
  SOPORTE_TECNICO: {
    codigo_capacidad: 'SOPORTE_TECNICO',
    nombre: 'Soporte tecnico',
    descripcion: 'Mesa de soporte, ordenes de servicio y gestion tecnica.',
  },
  PRECONTABILIDAD: {
    codigo_capacidad: 'PRECONTABILIDAD',
    nombre: 'Precontabilidad',
    descripcion: 'Preparacion contable operativa para el contador.',
  },
  EXPORTACION_CONTABLE: {
    codigo_capacidad: 'EXPORTACION_CONTABLE',
    nombre: 'Exportacion contable',
    descripcion: 'Exportables contables disponibles sobre Precontabilidad.',
  },
  FACTURACION_ELECTRONICA: {
    codigo_capacidad: 'FACTURACION_ELECTRONICA',
    nombre: 'Facturacion electronica',
    descripcion: 'Capacidad comercial para habilitar facturacion electronica.',
  },
  NOTAS_FISCALES: {
    codigo_capacidad: 'NOTAS_FISCALES',
    nombre: 'Notas fiscales',
    descripcion: 'Notas fiscales sobre facturacion electronica.',
  },
};

const CAPABILITY_DEPENDENCIES: Partial<Record<SaasManagedCapabilityCode, SaasManagedCapabilityCode>> = {
  EXPORTACION_CONTABLE: 'PRECONTABILIDAD',
  NOTAS_FISCALES: 'FACTURACION_ELECTRONICA',
};

const PUBLIC_BENEFIT_CAPABILITY_OPTIONS = [
  { value: '', label: 'Sin capacidad asociada' },
  { value: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
  { value: 'PRECONTABILIDAD', label: 'Precontabilidad' },
  { value: 'EXPORTACION_CONTABLE', label: 'Exportacion contable' },
  { value: 'FACTURACION_ELECTRONICA', label: 'Facturacion electronica' },
  { value: 'NOTAS_FISCALES', label: 'Notas fiscales' },
];

function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
}

function moneyInputValue(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  const n = Number(normalized || 0);
  return Number.isFinite(n) ? n : 0;
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return fallback;
  const data = response.data;
  if (typeof data !== 'object' || data === null || !('error' in data)) return fallback;
  return typeof data.error === 'string' && data.error.trim() ? data.error : fallback;
}

function apiStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) return null;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('status' in response)) return null;
  return typeof response.status === 'number' ? response.status : null;
}

function apiResponseData(error: unknown): Record<string, unknown> | null {
  if (typeof error !== 'object' || error === null || !('response' in error)) return null;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return null;
  const data = response.data;
  return typeof data === 'object' && data !== null ? data as Record<string, unknown> : null;
}

function diagnosticFromError(error: unknown): SaasCapabilityBlockDiagnostic | null {
  const data = apiResponseData(error);
  const diagnostic = data?.diagnostico_bloqueo;
  return typeof diagnostic === 'object' && diagnostic !== null
    ? diagnostic as SaasCapabilityBlockDiagnostic
    : null;
}

function withAllCapabilities(items: SaasPlanCapability[]): SaasPlanCapability[] {
  const map = new Map<SaasManagedCapabilityCode, SaasPlanCapability>();
  for (const capability of items) {
    map.set(capability.codigo_capacidad, capability);
  }
  for (const code of SAAS_MANAGED_CAPABILITY_ORDER) {
    if (!map.has(code)) {
      map.set(code, { ...CAPABILITY_FALLBACKS[code], incluida: false });
    }
  }
  return orderSaasCapabilities(Array.from(map.values()));
}

function emptyToNull(value?: string | null): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function publicProfileFromResponse(plan: SaasPlan, beneficios: SaasPlanPublicBenefit[] = []): SaveSaasPlanPublicProfilePayload {
  return {
    landing_titulo: plan.landing_titulo || '',
    landing_resumen: plan.landing_resumen || '',
    landing_icono: plan.landing_icono || '',
    landing_destacado: Boolean(plan.landing_destacado),
    landing_etiqueta: plan.landing_etiqueta || '',
    landing_cta_texto: plan.landing_cta_texto || '',
    beneficios,
  };
}

function publicProfilePayload(profile: SaveSaasPlanPublicProfilePayload): SaveSaasPlanPublicProfilePayload {
  return {
    landing_titulo: emptyToNull(profile.landing_titulo),
    landing_resumen: emptyToNull(profile.landing_resumen),
    landing_icono: String(profile.landing_icono ?? '').trim(),
    landing_destacado: Boolean(profile.landing_destacado),
    landing_etiqueta: emptyToNull(profile.landing_etiqueta),
    landing_cta_texto: String(profile.landing_cta_texto ?? '').trim(),
    beneficios: profile.beneficios.map((benefit) => ({
      ...benefit,
      codigo_capacidad: emptyToNull(benefit.codigo_capacidad),
      titulo: String(benefit.titulo ?? '').trim(),
      descripcion: emptyToNull(benefit.descripcion),
      icono: emptyToNull(benefit.icono),
      incluido: Boolean(benefit.incluido),
      orden: Number(benefit.orden || 0),
    })),
  };
}

function isAccountingReportsBenefit(benefit: SaasPlanPublicBenefit): boolean {
  return String(benefit.titulo ?? '').trim().toLowerCase() === 'reportes contables';
}

function toForm(plan: SaasPlan): SaveSaasPlanPayload {
  return {
    codigo: plan.codigo || '',
    nombre: plan.nombre || '',
    descripcion: plan.descripcion || '',
    precio_mensual: Number(plan.precio_mensual || 0),
    precio_anual: Number(plan.precio_anual || 0),
    usuarios_incluidos: Number(plan.usuarios_incluidos || 0),
    precio_usuario_extra_mensual: Number(plan.precio_usuario_extra_mensual || 0),
    precio_usuario_extra_anual: Number(plan.precio_usuario_extra_anual || 0),
    whatsapp_incluido: Boolean(plan.whatsapp_incluido),
    precio_whatsapp_mensual: Number(plan.precio_whatsapp_mensual || 0),
    precio_whatsapp_anual: Number(plan.precio_whatsapp_anual || 0),
    visible_publico: Boolean(plan.visible_publico ?? true),
    activo: Boolean(plan.activo),
    orden: Number(plan.orden || 100),
  };
}

export default function SaasPlansPage() {
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [selected, setSelected] = useState<SaasPlan | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>('comercial');
  const [form, setForm] = useState<SaveSaasPlanPayload>(emptyPlan);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capabilities, setCapabilities] = useState<SaasPlanCapability[]>([]);
  const [loadingCapabilities, setLoadingCapabilities] = useState(false);
  const [savingCapabilities, setSavingCapabilities] = useState(false);
  const [supportBlockDiagnostic, setSupportBlockDiagnostic] = useState<SaasCapabilityBlockDiagnostic | null>(null);
  const [publicProfile, setPublicProfile] = useState<SaveSaasPlanPublicProfilePayload>(emptyPublicProfile);
  const [loadingPublicProfile, setLoadingPublicProfile] = useState(false);
  const [savingPublicProfile, setSavingPublicProfile] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listarPlanesSaas(false);
      setPlans(res.items || []);
    } catch (error: unknown) {
      await Swal.fire('Error', apiErrorMessage(error, 'No se pudieron cargar los planes.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const monthlyTotal = useMemo(() => {
    return Number(form.precio_mensual || 0) + Number(form.precio_whatsapp_mensual || 0);
  }, [form.precio_mensual, form.precio_whatsapp_mensual]);

  const yearlyTotal = useMemo(() => {
    return Number(form.precio_anual || 0) + Number(form.precio_whatsapp_anual || 0);
  }, [form.precio_anual, form.precio_whatsapp_anual]);

  const update = <K extends keyof SaveSaasPlanPayload>(key: K, value: SaveSaasPlanPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateMoney = (key: keyof SaveSaasPlanPayload, value: string) => {
    setForm((prev) => ({ ...prev, [key]: parseMoneyInput(value) }));
  };

  const startNew = () => {
    setSelected(null);
    setForm(emptyPlan);
    setCapabilities([]);
    setPublicProfile(emptyPublicProfile);
    setEditorTab('comercial');
    setShowEditor(true);
  };

  const backToPlans = () => {
    setShowEditor(false);
  };

  const loadCapabilities = async (idPlan: number) => {
    setLoadingCapabilities(true);
    try {
      const out = await getPlanCapabilities(idPlan);
      setCapabilities(withAllCapabilities(out.items || []));
    } catch (error: unknown) {
      setCapabilities([]);
      await Swal.fire('Error', apiErrorMessage(error, 'No se pudieron cargar las capacidades del plan.'), 'error');
    } finally {
      setLoadingCapabilities(false);
    }
  };

  const loadPublicProfile = async (idPlan: number) => {
    setLoadingPublicProfile(true);
    try {
      const out = await getPlanPublicProfile(idPlan);
      setPublicProfile(publicProfileFromResponse(out.plan, out.beneficios || []));
    } catch (error: unknown) {
      setPublicProfile(emptyPublicProfile);
      await Swal.fire('Error', apiErrorMessage(error, 'No se pudo cargar la ficha publica.'), 'error');
    } finally {
      setLoadingPublicProfile(false);
    }
  };

  const editPlan = (plan: SaasPlan) => {
    setSelected(plan);
    setForm(toForm(plan));
    setEditorTab('comercial');
    setShowEditor(true);
    void loadCapabilities(plan.id_plan);
    void loadPublicProfile(plan.id_plan);
  };

  const toggleCapability = (codigo: SaasManagedCapabilityCode, incluida: boolean) => {
    setCapabilities((current) => {
      return withAllCapabilities(current).map((capability) => (
        capability.codigo_capacidad === codigo ? { ...capability, incluida } : capability
      ));
    });
  };

  const saveCapabilities = async () => {
    if (!selected) return;
    const current = withAllCapabilities(capabilities);
    const payload = Object.fromEntries(
      current.map((capability) => [capability.codigo_capacidad, Boolean(capability.incluida)])
    ) as Record<SaasManagedCapabilityCode, boolean>;

    setSavingCapabilities(true);
    try {
      const out = await savePlanCapabilities(selected.id_plan, payload);
      setCapabilities(withAllCapabilities(out.items || []));
      await loadCapabilities(selected.id_plan);
      await load();
      if (isSyncPending(out.sync)) {
        await Swal.fire(
          'Cambio guardado',
          'El cambio comercial fue guardado. Una o mas empresas seran sincronizadas automaticamente mediante reintento.',
          'info'
        );
      } else {
        await Swal.fire('Capacidades actualizadas', 'Las capacidades del plan fueron guardadas correctamente.', 'success');
      }
    } catch (error: unknown) {
      const status = apiStatus(error);
      const diagnostic = diagnosticFromError(error);
      if (status === 409 && diagnostic) {
        setSupportBlockDiagnostic(diagnostic);
        return;
      }
      await Swal.fire(
        status === 409 ? 'Conflicto al guardar' : 'Error',
        apiErrorMessage(error, 'No se pudieron guardar las capacidades.'),
        status === 409 ? 'warning' : 'error'
      );
    } finally {
      setSavingCapabilities(false);
    }
  };

  const save = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      await Swal.fire('Faltan datos', 'Codigo y nombre son obligatorios.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const wasNew = !selected;
      const payload: SaveSaasPlanPayload = {
        ...form,
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || null,
      };
      const out = selected
        ? await actualizarPlanSaas(selected.id_plan, payload)
        : await crearPlanSaas(payload);
      await load();
      setSelected(out.item);
      setForm(toForm(out.item));
      await loadCapabilities(out.item.id_plan);
      await loadPublicProfile(out.item.id_plan);
      if (wasNew) setEditorTab('publica');
      await Swal.fire('Listo', 'Plan guardado correctamente.', 'success');
    } catch (error: unknown) {
      const status = apiStatus(error);
      await Swal.fire(
        status === 409 ? 'Conflicto al guardar' : 'Error',
        apiErrorMessage(error, 'No se pudo guardar el plan.'),
        status === 409 ? 'warning' : 'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const updatePublicProfile = <K extends keyof SaveSaasPlanPublicProfilePayload>(key: K, value: SaveSaasPlanPublicProfilePayload[K]) => {
    setPublicProfile((current) => ({ ...current, [key]: value }));
  };

  const updateBenefit = (index: number, key: keyof SaasPlanPublicBenefit, value: SaasPlanPublicBenefit[keyof SaasPlanPublicBenefit]) => {
    setPublicProfile((current) => ({
      ...current,
      beneficios: current.beneficios.map((benefit, currentIndex) => currentIndex === index ? { ...benefit, [key]: value } : benefit),
    }));
  };

  const addBenefit = () => {
    updatePublicProfile('beneficios', [
      ...publicProfile.beneficios,
      {
        titulo: '',
        descripcion: '',
        icono: '',
        codigo_capacidad: null,
        incluido: true,
        orden: (publicProfile.beneficios.length + 1) * 10,
      },
    ]);
  };

  const removeBenefit = (index: number) => {
    updatePublicProfile('beneficios', publicProfile.beneficios.filter((_, currentIndex) => currentIndex !== index));
  };

  const moveBenefit = (index: number, direction: -1 | 1) => {
    setPublicProfile((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.beneficios.length) return current;
      const beneficios = [...current.beneficios];
      const currentBenefit = beneficios[index];
      const targetBenefit = beneficios[nextIndex];
      if (!currentBenefit || !targetBenefit) return current;
      beneficios[index] = { ...targetBenefit, orden: currentBenefit.orden };
      beneficios[nextIndex] = { ...currentBenefit, orden: targetBenefit.orden };
      return { ...current, beneficios };
    });
  };

  const replaceAccountingReportsWithPreaccounting = () => {
    setPublicProfile((current) => ({
      ...current,
      beneficios: current.beneficios.map((benefit) => {
        if (!isAccountingReportsBenefit(benefit)) return benefit;
        return {
          ...benefit,
          titulo: 'Precontabilidad',
          codigo_capacidad: 'PRECONTABILIDAD',
        };
      }),
    }));
  };

  const savePublicProfile = async () => {
    if (!selected) return;
    setSavingPublicProfile(true);
    try {
      const out = await savePlanPublicProfile(selected.id_plan, publicProfilePayload(publicProfile));
      setSelected(out.plan);
      setPublicProfile(publicProfileFromResponse(out.plan, out.beneficios || []));
      await load();
      await Swal.fire('Ficha publica guardada', 'La landing recibira este contenido cuando el plan sea publico y activo.', 'success');
    } catch (error: unknown) {
      await Swal.fire('Error', apiErrorMessage(error, 'No se pudo guardar la ficha publica.'), 'error');
    } finally {
      setSavingPublicProfile(false);
    }
  };

  return (
    <PageLayout title="Planes y precios">
      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h5 className="mb-1">
              {showEditor ? (selected ? `Editar plan: ${selected.nombre}` : 'Nuevo plan') : 'Catalogo comercial SaaS'}
            </h5>
            <div className="text-muted">
              {showEditor
                ? 'Configura precios, usuarios incluidos, beneficios y capacidades del plan.'
                : 'Administra precios, usuarios incluidos y beneficios sin tocar la base de datos.'}
            </div>
          </div>
          {showEditor ? (
            <button className="btn btn-outline-secondary" onClick={backToPlans}>Volver a planes</button>
          ) : (
            <button className="btn btn-primary" onClick={startNew}>Nuevo plan</button>
          )}
        </div>
      </div>

      <div className="row g-3">
        <div className={showEditor ? 'd-none' : 'col-12'}>
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <strong>Planes disponibles</strong>
              <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>Actualizar</button>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Plan</th>
                    <th>Mensual</th>
                    <th>Anual</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={5} className="text-center py-4">Cargando...</td></tr>}
                  {!loading && plans.length === 0 && <tr><td colSpan={5} className="text-center py-4">Sin planes</td></tr>}
                  {!loading && plans.map((plan) => (
                    <tr key={plan.id_plan}>
                      <td>
                        <strong>{plan.nombre}</strong>
                        <div className="text-muted small">{plan.codigo} / {plan.usuarios_incluidos} usuarios</div>
                        {plan.landing_titulo && (
                          <div className="text-muted small">Landing: {plan.landing_titulo}</div>
                        )}
                      </td>
                      <td>$ {money(plan.precio_mensual)}</td>
                      <td>$ {money(plan.precio_anual)}</td>
                      <td>
                        <span className={`badge ${plan.activo ? 'bg-success' : 'bg-secondary'}`}>
                          {plan.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        {plan.visible_publico && <div className="text-muted small">Publico</div>}
                      </td>
                      <td className="text-end">
                        <button className="btn btn-outline-primary btn-sm" onClick={() => editPlan(plan)}>Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={showEditor ? 'col-12' : 'd-none'}>
          <div className="card shadow-sm">
            <div className="card-header bg-white d-flex align-items-center justify-content-between gap-2 flex-wrap">
              <strong>{selected ? `Configuracion de ${selected.nombre}` : 'Informacion del nuevo plan'}</strong>
              {selected && <span className="text-muted small">Codigo: {selected.codigo}</span>}
            </div>
            <div className="card-header bg-white border-top-0">
              <div className="btn-group flex-wrap" role="tablist" aria-label="Secciones del plan">
                <button
                  type="button"
                  className={`btn btn-sm ${editorTab === 'comercial' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setEditorTab('comercial')}
                  role="tab"
                  aria-selected={editorTab === 'comercial'}
                >
                  Configuracion comercial
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${editorTab === 'capacidades' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setEditorTab('capacidades')}
                  disabled={!selected}
                  role="tab"
                  aria-selected={editorTab === 'capacidades'}
                >
                  Capacidades
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${editorTab === 'publica' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setEditorTab('publica')}
                  disabled={!selected}
                  role="tab"
                  aria-selected={editorTab === 'publica'}
                >
                  Presentacion publica
                </button>
              </div>
            </div>
            <div className="card-body">
              {editorTab === 'comercial' && (
                <>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Codigo</label>
                  <input className="form-control" style={inputStyle} value={form.codigo} onChange={(e) => update('codigo', e.target.value.toUpperCase())} placeholder="" />
                </div>
                <div className="col-md-8">
                  <label className="form-label">Nombre</label>
                  <input className="form-control" style={inputStyle} value={form.nombre} onChange={(e) => update('nombre', e.target.value)} placeholder="Nombre del plan" />
                </div>
                <div className="col-12">
                  <label className="form-label">Descripcion</label>
                  <textarea className="form-control" rows={2} value={form.descripcion || ''} onChange={(e) => update('descripcion', e.target.value)} />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Precio mensual</label>
                  <input className="form-control" style={inputStyle} inputMode="decimal" value={moneyInputValue(form.precio_mensual)} onChange={(e) => updateMoney('precio_mensual', e.target.value)} placeholder="" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Precio anual</label>
                  <input className="form-control" style={inputStyle} inputMode="decimal" value={moneyInputValue(form.precio_anual)} onChange={(e) => updateMoney('precio_anual', e.target.value)} placeholder="" />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Usuarios incluidos</label>
                  <input className="form-control" style={inputStyle} type="number" min={0} value={form.usuarios_incluidos} onChange={(e) => update('usuarios_incluidos', Number(e.target.value || 0))} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Usuario extra mensual</label>
                  <input className="form-control" style={inputStyle} inputMode="decimal" value={moneyInputValue(form.precio_usuario_extra_mensual)} onChange={(e) => updateMoney('precio_usuario_extra_mensual', e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Usuario extra anual</label>
                  <input className="form-control" style={inputStyle} inputMode="decimal" value={moneyInputValue(form.precio_usuario_extra_anual)} onChange={(e) => updateMoney('precio_usuario_extra_anual', e.target.value)} />
                </div>

                <div className="col-md-4 d-flex align-items-end">
                  <div className="form-check form-switch mb-2">
                    <input className="form-check-input" type="checkbox" checked={form.whatsapp_incluido} onChange={(e) => update('whatsapp_incluido', e.target.checked)} />
                    <label className="form-check-label">WhatsApp incluido</label>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">WhatsApp mensual</label>
                  <input className="form-control" style={inputStyle} inputMode="decimal" value={moneyInputValue(form.precio_whatsapp_mensual)} onChange={(e) => updateMoney('precio_whatsapp_mensual', e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">WhatsApp anual</label>
                  <input className="form-control" style={inputStyle} inputMode="decimal" value={moneyInputValue(form.precio_whatsapp_anual)} onChange={(e) => updateMoney('precio_whatsapp_anual', e.target.value)} />
                </div>

                <div className="col-md-4">
                  <label className="form-label">Orden</label>
                  <input className="form-control" style={inputStyle} type="number" value={form.orden} onChange={(e) => update('orden', Number(e.target.value || 0))} />
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <div className="form-check form-switch mb-2">
                    <input className="form-check-input" type="checkbox" checked={form.visible_publico} onChange={(e) => update('visible_publico', e.target.checked)} />
                    <label className="form-check-label">Visible publicamente</label>
                  </div>
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <div className="form-check form-switch mb-2">
                    <input className="form-check-input" type="checkbox" checked={form.activo} onChange={(e) => update('activo', e.target.checked)} />
                    <label className="form-check-label">Plan activo</label>
                  </div>
                </div>
              </div>

              <div className="border rounded mt-4 p-3 bg-light d-flex flex-wrap gap-4">
                <div>Mensual visible: <strong>$ {money(monthlyTotal)}</strong></div>
                <div>Anual visible: <strong>$ {money(yearlyTotal)}</strong></div>
                <div>Usuarios incluidos: <strong>{form.usuarios_incluidos}</strong></div>
              </div>
                </>
              )}

              {editorTab === 'capacidades' && (
              <section className="border rounded p-3">
                <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="fw-bold">Capacidades incluidas</div>
                    <div className="text-muted small">Define el techo comercial del plan. Las excepciones por empresa se administran desde su suscripcion.</div>
                  </div>
                  {selected && (
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={saveCapabilities}
                      disabled={loadingCapabilities || savingCapabilities || capabilities.length === 0}
                    >
                      {savingCapabilities ? 'Guardando...' : 'Guardar capacidades'}
                    </button>
                  )}
                </div>

                {!selected ? (
                  <div className="text-muted small">Guarda el plan primero para configurar sus capacidades.</div>
                ) : loadingCapabilities ? (
                  <div className="text-muted small">Cargando capacidades...</div>
                ) : (
                  <div className="row g-2">
                    {withAllCapabilities(capabilities).map((capability) => {
                      const dependency = CAPABILITY_DEPENDENCIES[capability.codigo_capacidad];
                      const dependencyActive = dependency
                        ? withAllCapabilities(capabilities).some((item) => item.codigo_capacidad === dependency && item.incluida)
                        : true;
                      return (
                      <div className="col-12 col-md-6" key={capability.codigo_capacidad}>
                        <label className="border rounded p-3 h-100 w-100 d-flex gap-3 align-items-start">
                          <input
                            className="form-check-input mt-1"
                            type="checkbox"
                            checked={Boolean(capability.incluida)}
                            onChange={(event) => toggleCapability(capability.codigo_capacidad, event.target.checked)}
                            disabled={savingCapabilities}
                          />
                          <span>
                            <span className="fw-semibold d-block">{capability.nombre}</span>
                            <span className="text-muted small">{capability.descripcion || capability.codigo_capacidad}</span>
                            {dependency && !dependencyActive && (
                              <span className="d-block text-warning small mt-1">
                                Requiere {CAPABILITY_FALLBACKS[dependency].nombre}. El backend validara esta dependencia al guardar.
                              </span>
                            )}
                          </span>
                        </label>
                      </div>
                      );
                    })}
                  </div>
                )}
              </section>
              )}

              {editorTab === 'publica' && (
              <section className="border rounded p-3">
                <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap mb-3">
                  <div>
                    <div className="fw-bold">Ficha publica de landing</div>
                    <div className="text-muted small">Este contenido se muestra para planes activos y visibles publicamente.</div>
                  </div>
                  {selected && (
                    <button className="btn btn-outline-primary btn-sm" onClick={savePublicProfile} disabled={loadingPublicProfile || savingPublicProfile}>
                      {savingPublicProfile ? 'Guardando...' : 'Guardar ficha publica'}
                    </button>
                  )}
                </div>

                {!selected ? (
                  <div className="text-muted small">Guarda el plan primero para crear su contenido publico.</div>
                ) : loadingPublicProfile ? (
                  <div className="text-muted small">Cargando ficha publica...</div>
                ) : (
                  <div className="row g-4">
                    <div className="col-12 col-xl-8">
                      {(!form.activo || !form.visible_publico) && (
                        <div className="alert alert-warning py-2">
                          Este plan se puede editar, pero no se presentara como publicado mientras este inactivo o no sea visible publicamente.
                        </div>
                      )}

                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label" htmlFor="landingTitulo">Titulo publico</label>
                          <input id="landingTitulo" className="form-control" style={inputStyle} value={publicProfile.landing_titulo || ''} onChange={(e) => updatePublicProfile('landing_titulo', e.target.value)} placeholder={form.nombre || 'Nombre del plan'} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label" htmlFor="landingIcono">Icono</label>
                          <input id="landingIcono" className="form-control" style={inputStyle} value={publicProfile.landing_icono || ''} onChange={(e) => updatePublicProfile('landing_icono', e.target.value)} />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label" htmlFor="landingEtiqueta">Etiqueta</label>
                          <input id="landingEtiqueta" className="form-control" style={inputStyle} value={publicProfile.landing_etiqueta || ''} onChange={(e) => updatePublicProfile('landing_etiqueta', e.target.value)} />
                        </div>
                        <div className="col-md-8">
                          <label className="form-label" htmlFor="landingResumen">Resumen</label>
                          <textarea id="landingResumen" className="form-control" rows={2} value={publicProfile.landing_resumen || ''} onChange={(e) => updatePublicProfile('landing_resumen', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label" htmlFor="landingCta">Texto CTA</label>
                          <input id="landingCta" className="form-control" style={inputStyle} value={publicProfile.landing_cta_texto || ''} onChange={(e) => updatePublicProfile('landing_cta_texto', e.target.value)} />
                          <div className="form-check form-switch mt-3">
                            <input id="landingDestacado" className="form-check-input" type="checkbox" checked={Boolean(publicProfile.landing_destacado)} onChange={(e) => updatePublicProfile('landing_destacado', e.target.checked)} />
                            <label className="form-check-label" htmlFor="landingDestacado">Destacado en landing</label>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 d-flex align-items-center justify-content-between gap-2 flex-wrap">
                        <div>
                          <strong className="small d-block">Matriz editorial de funciones</strong>
                          <span className="text-muted small">La explicacion se muestra en el boton ? del plan publico. Las funciones apagadas se conservan atenuadas.</span>
                        </div>
                        <div className="d-flex gap-2 flex-wrap justify-content-end">
                          {publicProfile.beneficios.some(isAccountingReportsBenefit) && (
                            <button className="btn btn-outline-warning btn-sm" type="button" onClick={replaceAccountingReportsWithPreaccounting}>
                              Reportes contables a Precontabilidad
                            </button>
                          )}
                          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={addBenefit}>
                            Agregar funcion
                          </button>
                        </div>
                      </div>

                      <div className="table-responsive mt-2">
                        <table className="table table-sm align-middle">
                          <thead className="table-light">
                            <tr>
                              <th style={{ width: 78 }}>Orden</th>
                              <th style={{ minWidth: 190 }}>Funcion</th>
                              <th style={{ minWidth: 280 }}>Explicacion ?</th>
                              <th style={{ width: 130 }}>Icono</th>
                              <th style={{ width: 120 }}>Incluido</th>
                              <th style={{ width: 190 }}>Capacidad</th>
                              <th style={{ width: 128 }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {publicProfile.beneficios.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="text-muted py-3">
                                  Sin funciones editoriales para este plan.
                                </td>
                              </tr>
                            ) : publicProfile.beneficios.map((benefit, index) => (
                              <tr key={`${benefit.id_beneficio || 'nuevo'}-${index}`}>
                                <td>
                                  <input
                                    className="form-control form-control-sm"
                                    type="number"
                                    value={benefit.orden}
                                    aria-label={`Orden de ${benefit.titulo || `funcion ${index + 1}`}`}
                                    onChange={(e) => updateBenefit(index, 'orden', Number(e.target.value || 0))}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-control form-control-sm"
                                    value={benefit.titulo}
                                    aria-label={`Titulo de funcion ${index + 1}`}
                                    onChange={(e) => updateBenefit(index, 'titulo', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <textarea
                                    className="form-control form-control-sm"
                                    rows={2}
                                    value={benefit.descripcion || ''}
                                    aria-label={`Explicacion de ${benefit.titulo || `funcion ${index + 1}`}`}
                                    onChange={(e) => updateBenefit(index, 'descripcion', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-control form-control-sm"
                                    value={benefit.icono || ''}
                                    aria-label={`Icono de ${benefit.titulo || `funcion ${index + 1}`}`}
                                    onChange={(e) => updateBenefit(index, 'icono', e.target.value)}
                                  />
                                </td>
                                <td>
                                  <div className="form-check form-switch">
                                    <input
                                      id={`benefitIncluded-${index}`}
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={benefit.incluido}
                                      onChange={(e) => updateBenefit(index, 'incluido', e.target.checked)}
                                    />
                                    <label className="form-check-label small" htmlFor={`benefitIncluded-${index}`}>
                                      {benefit.incluido ? 'Si' : 'No'}
                                    </label>
                                  </div>
                                </td>
                                <td>
                                  <select
                                    className="form-select form-select-sm"
                                    value={benefit.codigo_capacidad || ''}
                                    aria-label={`Capacidad de ${benefit.titulo || `funcion ${index + 1}`}`}
                                    onChange={(e) => updateBenefit(index, 'codigo_capacidad', e.target.value || null)}
                                  >
                                    {PUBLIC_BENEFIT_CAPABILITY_OPTIONS.map((option) => (
                                      <option key={option.value || 'none'} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                </td>
                                <td>
                                  <div className="btn-group btn-group-sm" role="group" aria-label={`Acciones de ${benefit.titulo || `funcion ${index + 1}`}`}>
                                    <button className="btn btn-outline-secondary" type="button" title="Subir" aria-label={`Subir ${benefit.titulo || `funcion ${index + 1}`}`} disabled={index === 0} onClick={() => moveBenefit(index, -1)}>
                                      <MI name="arrow_upward" size={18} />
                                    </button>
                                    <button className="btn btn-outline-secondary" type="button" title="Bajar" aria-label={`Bajar ${benefit.titulo || `funcion ${index + 1}`}`} disabled={index === publicProfile.beneficios.length - 1} onClick={() => moveBenefit(index, 1)}>
                                      <MI name="arrow_downward" size={18} />
                                    </button>
                                    <button className="btn btn-outline-danger" type="button" title="Eliminar" aria-label={`Eliminar ${benefit.titulo || `funcion ${index + 1}`}`} onClick={() => removeBenefit(index)}>
                                      <MI name="delete" size={18} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="col-12 col-xl-4">
                      <div className="border rounded p-3 bg-light h-100">
                        <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                          <div>
                            <div className="text-muted small">{publicProfile.landing_etiqueta || form.codigo || 'PLAN'}</div>
                            <h5 className="mb-1">{publicProfile.landing_titulo || form.nombre || 'Nombre del plan'}</h5>
                            <div className="text-muted small">{publicProfile.landing_resumen || form.descripcion || 'Sin resumen publico.'}</div>
                          </div>
                          <span className="border rounded px-2 py-1 small">{publicProfile.landing_icono || '-'}</span>
                        </div>

                        <div className="row g-2 mb-3">
                          <div className="col-6">
                            <div className="border rounded p-2 bg-white">
                              <div className="text-muted small">Mensual</div>
                              <strong>$ {money(form.precio_mensual)}</strong>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="border rounded p-2 bg-white">
                              <div className="text-muted small">Anual</div>
                              <strong>$ {money(form.precio_anual)}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="d-flex flex-wrap gap-2 mb-3">
                          <span className="badge text-bg-light border text-dark">{form.usuarios_incluidos} usuarios incluidos</span>
                          {form.whatsapp_incluido && <span className="badge text-bg-light border text-dark">WhatsApp incluido</span>}
                          {publicProfile.landing_destacado && <span className="badge text-bg-info">Destacado</span>}
                        </div>

                        <div className="fw-bold small mb-2">Incluye</div>
                        <div className="d-flex flex-column gap-2">
                          {publicProfile.beneficios.length === 0 ? (
                            <div className="text-muted small">Sin funciones para previsualizar.</div>
                          ) : publicProfile.beneficios.map((benefit, index) => (
                            <div className={`d-flex align-items-start gap-2 small ${benefit.incluido ? '' : 'text-muted opacity-75'}`} key={`preview-${benefit.id_beneficio || index}`}>
                              <span className={`badge rounded-pill ${benefit.incluido ? 'text-bg-success' : 'text-bg-secondary'}`}>{benefit.incluido ? '✓' : '-'}</span>
                              <span className="flex-grow-1">{benefit.titulo || `Funcion ${index + 1}`}</span>
                              <button type="button" className="btn btn-sm btn-outline-primary py-0 px-2" title={benefit.descripcion || 'Sin explicacion'} aria-label={`${benefit.titulo || `Funcion ${index + 1}`}: ${benefit.descripcion || 'Sin explicacion'}`}>
                                ?
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3">
                          <button className="btn btn-primary btn-sm w-100" type="button" disabled>
                            {publicProfile.landing_cta_texto || 'CTA'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
              )}
            </div>
            <div className="card-footer bg-white d-flex justify-content-between gap-2 flex-wrap">
              <button className="btn btn-outline-secondary" onClick={startNew}>Limpiar</button>
              <div className="d-flex gap-2 flex-wrap">
                {editorTab !== 'comercial' && (
                  <button className="btn btn-outline-secondary" type="button" onClick={() => setEditorTab('comercial')}>
                    Ir a configuracion
                  </button>
                )}
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar plan'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <SupportBlockDiagnosticModal
        diagnostic={supportBlockDiagnostic}
        onClose={() => setSupportBlockDiagnostic(null)}
      />
    </PageLayout>
  );
}
