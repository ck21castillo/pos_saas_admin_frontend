import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import {
  actualizarPlanSaas,
  crearPlanSaas,
  listarPlanesSaas,
  type SaasPlan,
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
  const [form, setForm] = useState<SaveSaasPlanPayload>(emptyPlan);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listarPlanesSaas(false);
      setPlans(res.items || []);
    } catch (error: any) {
      await Swal.fire('Error', error?.response?.data?.error || 'No se pudieron cargar los planes.', 'error');
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
  };

  const editPlan = (plan: SaasPlan) => {
    setSelected(plan);
    setForm(toForm(plan));
  };

  const save = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) {
      await Swal.fire('Faltan datos', 'Codigo y nombre son obligatorios.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload: SaveSaasPlanPayload = {
        ...form,
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion?.trim() || null,
      };
      if (selected) {
        await actualizarPlanSaas(selected.id_plan, payload);
      } else {
        await crearPlanSaas(payload);
      }
      await load();
      startNew();
      await Swal.fire('Listo', 'Plan guardado correctamente.', 'success');
    } catch (error: any) {
      await Swal.fire('Error', error?.response?.data?.error || 'No se pudo guardar el plan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Planes y precios">
      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h5 className="mb-1">Catalogo comercial SaaS</h5>
            <div className="text-muted">Administra precios, usuarios incluidos y beneficios sin tocar la base de datos.</div>
          </div>
          <button className="btn btn-primary" onClick={startNew}>Nuevo plan</button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-5">
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

        <div className="col-12 col-xl-7">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <strong>{selected ? `Editar ${selected.nombre}` : 'Crear plan'}</strong>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Codigo</label>
                  <input className="form-control" style={inputStyle} value={form.codigo} onChange={(e) => update('codigo', e.target.value.toUpperCase())} placeholder="PRO" />
                </div>
                <div className="col-md-8">
                  <label className="form-label">Nombre</label>
                  <input className="form-control" style={inputStyle} value={form.nombre} onChange={(e) => update('nombre', e.target.value)} placeholder="Bersano POS Pro" />
                </div>
                <div className="col-12">
                  <label className="form-label">Descripcion</label>
                  <textarea className="form-control" rows={2} value={form.descripcion || ''} onChange={(e) => update('descripcion', e.target.value)} />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Precio mensual</label>
                  <input className="form-control" style={inputStyle} inputMode="decimal" value={moneyInputValue(form.precio_mensual)} onChange={(e) => updateMoney('precio_mensual', e.target.value)} placeholder="80.000" />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Precio anual</label>
                  <input className="form-control" style={inputStyle} inputMode="decimal" value={moneyInputValue(form.precio_anual)} onChange={(e) => updateMoney('precio_anual', e.target.value)} placeholder="800.000" />
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
            </div>
            <div className="card-footer bg-white d-flex justify-content-end gap-2">
              <button className="btn btn-outline-secondary" onClick={startNew}>Limpiar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar plan'}</button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
