import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  extenderPruebaSuscripcion,
  getEmpresaSuscripcion,
  reactivarEmpresaSuscripcion,
  registrarPagoSuscripcion,
  saveEmpresaSuscripcion,
  suspenderEmpresaSuscripcion,
  type CompanySubscriptionResponse,
  type SaasCiclo,
  type SaasEstado,
  type SaasPlan,
  type SaasSubscription,
  type SaveSubscriptionPayload,
} from '../../api/adminSaas';

type Props = {
  idEmpresa: number;
};

type SubscriptionForm = SaveSubscriptionPayload;

type PaymentForm = {
  fecha_pago: string;
  valor_pagado: number;
  canal_pago: string;
  referencia: string;
  observaciones: string;
};

const ESTADOS: SaasEstado[] = ['PRUEBA', 'ACTIVA', 'POR_VENCER', 'VENCIDA', 'SUSPENDIDA'];
const CICLOS: SaasCiclo[] = ['MENSUAL', 'ANUAL'];

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value?: string | null): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function money(value?: number | string | null): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
}

function moneyInputValue(value?: number | string | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

function parseMoneyInput(value: string): number {
  const cleaned = value.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function statusClass(value?: string | null): string {
  switch (String(value ?? '').toUpperCase()) {
    case 'ACTIVA':
      return 'text-bg-success';
    case 'PRUEBA':
    case 'POR_VENCER':
      return 'text-bg-warning';
    case 'VENCIDA':
    case 'SUSPENDIDA':
      return 'text-bg-danger';
    default:
      return 'text-bg-secondary';
  }
}

function planPrice(plan: SaasPlan | null | undefined, ciclo: string): number {
  if (!plan) return 0;
  return String(ciclo).toUpperCase() === 'ANUAL'
    ? Number(plan.precio_anual ?? 0)
    : Number(plan.precio_mensual ?? 0);
}

function extraUserPrice(plan: SaasPlan | null | undefined, ciclo: string): number {
  if (!plan) return 0;
  return String(ciclo).toUpperCase() === 'ANUAL'
    ? Number(plan.precio_usuario_extra_anual ?? 0)
    : Number(plan.precio_usuario_extra_mensual ?? 0);
}

function whatsappPrice(plan: SaasPlan | null | undefined, ciclo: string): number {
  if (!plan || plan.whatsapp_incluido) return 0;
  return String(ciclo).toUpperCase() === 'ANUAL'
    ? Number(plan.precio_whatsapp_anual ?? 0)
    : Number(plan.precio_whatsapp_mensual ?? 0);
}

function computeTotal(plan: SaasPlan | null | undefined, form: SubscriptionForm): number {
  const base = planPrice(plan, form.ciclo);
  const extra = Math.max(0, Number(form.usuarios_extra ?? 0)) * extraUserPrice(plan, form.ciclo);
  const wa = form.whatsapp_activo ? whatsappPrice(plan, form.ciclo) : 0;
  const discount = Math.max(0, Number(form.descuento_periodo ?? 0));
  return Math.max(0, base + extra + wa - discount);
}

function emptyForm(plan?: SaasPlan): SubscriptionForm {
  return {
    id_plan: Number(plan?.id_plan ?? 0),
    estado: 'PRUEBA',
    ciclo: 'MENSUAL',
    periodo_inicio: '',
    periodo_fin: '',
    proximo_pago_fecha: '',
    gracia_hasta: '',
    prueba_inicio: todayYmd(),
    prueba_fin: '',
    usuarios_incluidos: Number(plan?.usuarios_incluidos ?? 3),
    usuarios_extra: 0,
    whatsapp_activo: Boolean(plan?.whatsapp_incluido ?? false),
    descuento_periodo: 0,
    notas: '',
  };
}

function formFromData(data: CompanySubscriptionResponse | null): SubscriptionForm {
  const sub = data?.suscripcion ?? null;
  const plan = data?.planes.find((p) => p.id_plan === Number(sub?.id_plan ?? 0)) ?? data?.planes[0];
  if (!sub) return emptyForm(plan);

  return {
    id_plan: Number(sub.id_plan ?? plan?.id_plan ?? 0),
    estado: String(sub.estado ?? 'ACTIVA') as SaasEstado,
    ciclo: String(sub.ciclo ?? 'MENSUAL') as SaasCiclo,
    periodo_inicio: dateOnly(sub.periodo_inicio),
    periodo_fin: dateOnly(sub.periodo_fin),
    proximo_pago_fecha: dateOnly(sub.proximo_pago_fecha),
    gracia_hasta: dateOnly(sub.gracia_hasta),
    prueba_inicio: dateOnly(sub.prueba_inicio),
    prueba_fin: dateOnly(sub.prueba_fin),
    usuarios_incluidos: Number(sub.usuarios_incluidos ?? plan?.usuarios_incluidos ?? 3),
    usuarios_extra: Number(sub.usuarios_extra ?? 0),
    whatsapp_activo: Boolean(sub.whatsapp_activo ?? plan?.whatsapp_incluido ?? false),
    descuento_periodo: Number(sub.descuento_periodo ?? 0),
    notas: String(sub.notas ?? ''),
  };
}

export default function SaasSubscriptionPanel({ idEmpresa }: Props) {
  const [data, setData] = useState<CompanySubscriptionResponse | null>(null);
  const [form, setForm] = useState<SubscriptionForm>(emptyForm());
  const [payment, setPayment] = useState<PaymentForm>({
    fecha_pago: todayYmd(),
    valor_pagado: 0,
    canal_pago: 'TRANSFERENCIA',
    referencia: '',
    observaciones: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedPlan = useMemo(() => {
    return data?.planes.find((p) => p.id_plan === Number(form.id_plan)) ?? data?.planes[0] ?? null;
  }, [data?.planes, form.id_plan]);

  const total = useMemo(() => computeTotal(selectedPlan, form), [selectedPlan, form]);
  const tenantStatus = String(data?.empresa.tenant_estado ?? '').toUpperCase();
  const companyActive = Number(data?.empresa.estado ?? 0) === 1;
  const accessBlocked = tenantStatus === 'SUSPENDED' || !companyActive;
  const accessLabel = accessBlocked ? 'Bloqueado' : 'Activo';
  const accessClass = accessBlocked ? 'text-bg-danger' : 'text-bg-success';

  const load = useCallback(async () => {
    if (!idEmpresa) return;
    setLoading(true);
    try {
      const out = await getEmpresaSuscripcion(idEmpresa);
      setData(out);
      const nextForm = formFromData(out);
      setForm(nextForm);
      setPayment((prev) => ({
        ...prev,
        canal_pago: out.canales_pago[0]?.codigo ?? prev.canal_pago,
        valor_pagado: computeTotal(
          out.planes.find((p) => p.id_plan === Number(nextForm.id_plan)) ?? out.planes[0],
          nextForm
        ),
      }));
    } catch {
      await Swal.fire('Error', 'No se pudo cargar la suscripcion de la empresa.', 'error');
    } finally {
      setLoading(false);
    }
  }, [idEmpresa]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPayment((prev) => ({ ...prev, valor_pagado: total }));
  }, [total]);

  const updateField = <K extends keyof SubscriptionForm>(key: K, value: SubscriptionForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const reflectSubscription = (
    subscription: SaasSubscription | null | undefined,
    empresaPatch: Partial<CompanySubscriptionResponse['empresa']> = {}
  ) => {
    if (!subscription || !data) return;
    const nextData: CompanySubscriptionResponse = {
      ...data,
      empresa: { ...data.empresa, ...empresaPatch },
      suscripcion: subscription,
    };
    setData(nextData);
    setForm(formFromData(nextData));
  };

  const saveSubscription = async () => {
    if (!form.id_plan) {
      await Swal.fire('Plan requerido', 'Selecciona un plan antes de guardar.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const out = await saveEmpresaSuscripcion(idEmpresa, form);
      reflectSubscription(out.item);
      await load();
      await Swal.fire('Guardado', 'Suscripcion actualizada correctamente.', 'success');
    } catch {
      await Swal.fire('Error', 'No se pudo guardar la suscripcion.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const registerPayment = async () => {
    if (!form.id_plan) {
      await Swal.fire('Plan requerido', 'Selecciona un plan antes de registrar el pago.', 'warning');
      return;
    }
    if (Number(payment.valor_pagado) <= 0) {
      await Swal.fire('Valor invalido', 'El pago debe ser mayor a cero.', 'warning');
      return;
    }

    const ok = await Swal.fire({
      title: 'Registrar pago',
      text: `Se registrara un pago por $ ${money(payment.valor_pagado)}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;

    setSaving(true);
    try {
      const out = await registrarPagoSuscripcion(idEmpresa, {
        id_plan: Number(form.id_plan),
        ciclo: form.ciclo,
        fecha_pago: payment.fecha_pago || todayYmd(),
        periodo_inicio: form.periodo_inicio || payment.fecha_pago || todayYmd(),
        periodo_fin: form.periodo_fin || null,
        valor_pagado: Number(payment.valor_pagado),
        canal_pago: payment.canal_pago || 'TRANSFERENCIA',
        referencia: payment.referencia || null,
        observaciones: payment.observaciones || null,
        usuarios_incluidos: Number(form.usuarios_incluidos),
        usuarios_extra: Number(form.usuarios_extra),
        whatsapp_activo: Boolean(form.whatsapp_activo),
        descuento_periodo: Number(form.descuento_periodo ?? 0),
      });
      reflectSubscription(out.suscripcion, { estado: 1, tenant_estado: 'ACTIVE' });
      await load();
      await Swal.fire('Pago registrado', 'La empresa quedo activa segun el periodo pagado.', 'success');
    } catch {
      await Swal.fire('Error', 'No se pudo registrar el pago.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const suspend = async () => {
    const answer = await Swal.fire({
      title: 'Suspender empresa',
      input: 'text',
      inputLabel: 'Motivo',
      inputPlaceholder: 'Ej: vencimiento de pago',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Suspender',
      cancelButtonText: 'Cancelar',
    });
    if (!answer.isConfirmed) return;

    setSaving(true);
    try {
      const out = await suspenderEmpresaSuscripcion(idEmpresa, String(answer.value ?? ''));
      reflectSubscription(out.item, { estado: 0, tenant_estado: 'SUSPENDED' });
      await load();
      await Swal.fire('Suspendida', 'La empresa fue suspendida.', 'success');
    } catch {
      await Swal.fire('Error', 'No se pudo suspender la empresa.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async () => {
    const ok = await Swal.fire({
      title: 'Reactivar empresa',
      text: 'La empresa volvera a quedar habilitada.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Reactivar',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;

    setSaving(true);
    try {
      const out = await reactivarEmpresaSuscripcion(idEmpresa);
      reflectSubscription(out.item, { estado: 1, tenant_estado: 'ACTIVE' });
      await load();
      await Swal.fire('Reactivada', 'La empresa fue reactivada.', 'success');
    } catch {
      await Swal.fire('Error', 'No se pudo reactivar la empresa.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const extendTrial = async () => {
    const answer = await Swal.fire({
      title: 'Extender prueba',
      input: 'number',
      inputLabel: 'Dias de prueba',
      inputValue: 2,
      inputAttributes: { min: '1', max: '90', step: '1' },
      showCancelButton: true,
      confirmButtonText: 'Extender',
      cancelButtonText: 'Cancelar',
    });
    if (!answer.isConfirmed) return;

    setSaving(true);
    try {
      const out = await extenderPruebaSuscripcion(idEmpresa, Number(answer.value || 2));
      reflectSubscription(out.item, { estado: 1, tenant_estado: 'ACTIVE' });
      await load();
      await Swal.fire('Prueba actualizada', 'La prueba fue extendida.', 'success');
    } catch {
      await Swal.fire('Error', 'No se pudo extender la prueba.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-4">Cargando suscripcion...</div>;
  }

  if (!data) {
    return (
      <div className="alert alert-warning">
        No se pudo cargar la informacion comercial de esta empresa.
      </div>
    );
  }

  return (
    <div className="row g-3">
      <div className="col-12">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <div className="fw-bold fs-5">{data.empresa.nombre}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Tenant: {data.empresa.db_name || '-'} / acceso:{' '}
              <span className={`badge ${accessClass}`}>{accessLabel}</span>
              {tenantStatus ? <> / tenant: {tenantStatus}</> : null}
            </div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={saving}>
              Actualizar
            </button>
            <button className="btn btn-outline-warning btn-sm" onClick={extendTrial} disabled={saving}>
              Extender prueba
            </button>
            <button className="btn btn-outline-success btn-sm" onClick={reactivate} disabled={saving}>
              Reactivar
            </button>
            <button className="btn btn-outline-danger btn-sm" onClick={suspend} disabled={saving}>
              Suspender
            </button>
          </div>
        </div>
      </div>

      <div className="col-12 col-md-3">
        <div className="card h-100">
          <div className="card-body">
            <div className="text-muted">Estado comercial</div>
            <span className={`badge mt-2 ${statusClass(form.estado)}`}>{form.estado || '-'}</span>
            <div className="text-muted mt-3">Acceso POS</div>
            <span className={`badge mt-2 ${accessClass}`}>{accessLabel}</span>
            <div className="text-muted mt-2" style={{ fontSize: 12 }}>
              {data.suscripcion?.en_gracia ? 'En periodo de gracia' : 'Sin gracia activa'}
            </div>
          </div>
        </div>
      </div>
      <div className="col-12 col-md-3">
        <div className="card h-100">
          <div className="card-body">
            <div className="text-muted">Plan</div>
            <div className="fw-bold fs-5">{selectedPlan?.nombre ?? '-'}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>{form.ciclo}</div>
          </div>
        </div>
      </div>
      <div className="col-12 col-md-3">
        <div className="card h-100">
          <div className="card-body">
            <div className="text-muted">Proximo pago</div>
            <div className="fw-bold fs-5">{form.proximo_pago_fecha || form.periodo_fin || '-'}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>Gracia: {form.gracia_hasta || '-'}</div>
          </div>
        </div>
      </div>
      <div className="col-12 col-md-3">
        <div className="card h-100">
          <div className="card-body">
            <div className="text-muted">Total periodo</div>
            <div className="fw-bold fs-5">$ {money(total)}</div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Usuarios extra: {form.usuarios_extra}
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-body">
            <div className="fw-bold mb-3">Configuracion de suscripcion</div>
            {data.planes.length === 0 && (
              <div className="alert alert-warning py-2">No hay planes activos configurados.</div>
            )}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small">Plan</label>
                <select
                  className="form-select"
                  value={form.id_plan}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const plan = data.planes.find((p) => p.id_plan === id);
                    setForm((prev) => ({
                      ...prev,
                      id_plan: id,
                      usuarios_incluidos: Number(plan?.usuarios_incluidos ?? prev.usuarios_incluidos),
                      whatsapp_activo: Boolean(plan?.whatsapp_incluido ?? prev.whatsapp_activo),
                    }));
                  }}
                >
                  {data.planes.map((p) => (
                    <option key={p.id_plan} value={p.id_plan}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small">Estado</label>
                <select
                  className="form-select"
                  value={form.estado}
                  onChange={(e) => updateField('estado', e.target.value as SaasEstado)}
                >
                  {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small">Ciclo</label>
                <select
                  className="form-select"
                  value={form.ciclo}
                  onChange={(e) => updateField('ciclo', e.target.value as SaasCiclo)}
                >
                  {CICLOS.map((ciclo) => <option key={ciclo} value={ciclo}>{ciclo}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small">Prueba inicio</label>
                <input className="form-control" type="date" value={form.prueba_inicio || ''} onChange={(e) => updateField('prueba_inicio', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Prueba fin</label>
                <input className="form-control" type="date" value={form.prueba_fin || ''} onChange={(e) => updateField('prueba_fin', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Periodo inicio</label>
                <input className="form-control" type="date" value={form.periodo_inicio || ''} onChange={(e) => updateField('periodo_inicio', e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label small">Periodo fin</label>
                <input className="form-control" type="date" value={form.periodo_fin || ''} onChange={(e) => updateField('periodo_fin', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Proximo pago</label>
                <input className="form-control" type="date" value={form.proximo_pago_fecha || ''} onChange={(e) => updateField('proximo_pago_fecha', e.target.value)} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Gracia hasta</label>
                <input className="form-control" type="date" value={form.gracia_hasta || ''} onChange={(e) => updateField('gracia_hasta', e.target.value)} />
              </div>
              <div className="col-md-2">
                <label className="form-label small">Usuarios incluidos</label>
                <input className="form-control" type="number" min={1} value={form.usuarios_incluidos} onChange={(e) => updateField('usuarios_incluidos', Number(e.target.value))} />
              </div>
              <div className="col-md-2">
                <label className="form-label small">Usuarios extra</label>
                <input className="form-control" type="number" min={0} value={form.usuarios_extra} onChange={(e) => updateField('usuarios_extra', Number(e.target.value))} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Descuento periodo</label>
                <input className="form-control" type="number" min={0} step="0.01" value={form.descuento_periodo} onChange={(e) => updateField('descuento_periodo', Number(e.target.value))} />
              </div>
              <div className="col-md-8 d-flex align-items-end">
                <div className="form-check form-switch">
                  <input
                    id="whatsappActivo"
                    className="form-check-input"
                    type="checkbox"
                    checked={Boolean(form.whatsapp_activo)}
                    onChange={(e) => updateField('whatsapp_activo', e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="whatsappActivo">
                    WhatsApp activo para este plan
                  </label>
                </div>
              </div>
              <div className="col-12">
                <label className="form-label small">Notas internas</label>
                <textarea className="form-control" rows={2} value={form.notas || ''} onChange={(e) => updateField('notas', e.target.value)} />
              </div>
            </div>
            <div className="border rounded p-3 mt-3 bg-light">
              <div className="row g-2 small">
                <div className="col-md-3">Plan: <b>$ {money(planPrice(selectedPlan, form.ciclo))}</b></div>
                <div className="col-md-3">Usuarios extra: <b>$ {money(Number(form.usuarios_extra) * extraUserPrice(selectedPlan, form.ciclo))}</b></div>
                <div className="col-md-3">WhatsApp: <b>$ {money(form.whatsapp_activo ? whatsappPrice(selectedPlan, form.ciclo) : 0)}</b></div>
                <div className="col-md-3">Total: <b>$ {money(total)}</b></div>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button className="btn btn-primary" onClick={saveSubscription} disabled={saving || data.planes.length === 0}>
                {saving ? 'Guardando...' : 'Guardar suscripcion'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-body">
            <div className="fw-bold mb-3">Registrar pago</div>
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label small">Fecha pago</label>
                <input className="form-control" type="date" value={payment.fecha_pago} onChange={(e) => setPayment((prev) => ({ ...prev, fecha_pago: e.target.value }))} />
              </div>
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label small">Valor pagado</label>
                <input
                  className="form-control"
                  type="text"
                  inputMode="decimal"
                  value={moneyInputValue(payment.valor_pagado)}
                  placeholder="0"
                  onChange={(e) => setPayment((prev) => ({ ...prev, valor_pagado: parseMoneyInput(e.target.value) }))}
                />
              </div>
              <div className="col-12 col-md-6 col-xl-3">
                <label className="form-label small">Canal</label>
                <select className="form-select" value={payment.canal_pago} onChange={(e) => setPayment((prev) => ({ ...prev, canal_pago: e.target.value }))}>
                  {data.canales_pago.map((canal) => (
                    <option key={canal.codigo} value={canal.codigo}>{canal.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="col-12 col-md-6 col-xl-2">
                <label className="form-label small">Referencia</label>
                <input className="form-control" value={payment.referencia} onChange={(e) => setPayment((prev) => ({ ...prev, referencia: e.target.value }))} />
              </div>
              <div className="col-12 col-xl-3">
                <label className="form-label small">Observaciones</label>
                <textarea className="form-control" rows={1} value={payment.observaciones} onChange={(e) => setPayment((prev) => ({ ...prev, observaciones: e.target.value }))} />
              </div>
              <div className="col-12 d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="text-muted" style={{ fontSize: 12 }}>
                  El pago actualiza el periodo, calcula la gracia y reactiva la empresa si estaba suspendida.
                </div>
                <button className="btn btn-success" onClick={registerPayment} disabled={saving || data.planes.length === 0}>
                  Registrar pago y activar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card">
          <div className="card-body">
            <div className="fw-bold mb-3">Pagos recientes</div>
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Plan</th>
                    <th>Ciclo</th>
                    <th>Periodo</th>
                    <th>Canal</th>
                    <th>Referencia</th>
                    <th className="text-end">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pagos_recientes.length === 0 ? (
                    <tr><td colSpan={7} className="text-muted py-3">Sin pagos registrados.</td></tr>
                  ) : data.pagos_recientes.map((pago) => (
                    <tr key={pago.id_pago}>
                      <td>{dateOnly(pago.fecha_pago)}</td>
                      <td>{pago.plan_nombre || pago.plan_codigo || '-'}</td>
                      <td>{pago.ciclo}</td>
                      <td>{dateOnly(pago.periodo_inicio)} / {dateOnly(pago.periodo_fin)}</td>
                      <td>{pago.canal_pago}</td>
                      <td>{pago.referencia || '-'}</td>
                      <td className="text-end">$ {money(pago.valor_pagado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

