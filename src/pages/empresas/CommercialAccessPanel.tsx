import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  activateEmpresaComplemento,
  applyEmpresaExcepcionInterna,
  deactivateEmpresaComplemento,
  getEmpresaAccesosEfectivos,
  getEmpresaComplementos,
  getEmpresaComplementosElegibles,
  getEmpresaEntitlementExcepciones,
  getSaasComplementos,
  restoreEmpresaComplemento,
  type EmpresaAccesoEfectivoModulo,
  type EmpresaAccesoEfectivoPermiso,
  type EmpresaAccesosEfectivos,
  type EmpresaComplementoActivacion,
  type EmpresaComplementoElegible,
  type EmpresaEntitlementExcepcion,
  type EmpresaModuloItem,
  type EmpresaPermisoNoDisponible,
  type EmpresaPermisoItem,
  type SaasComplementoCatalogo,
} from '../../api/adminEmpresas';
import { buildPermissionGroups, findPermissionGroupForModule } from './permissionCatalog';

type Props = { idEmpresa: number; modulos: EmpresaModuloItem[]; permisos: EmpresaPermisoItem[] };
type ActivationEditor = {
  complemento: EmpresaComplementoElegible;
  ciclo: 'MENSUAL' | 'ANUAL';
  fechaInicio: string;
  fechaFin: string;
  valorMensual: string;
  valorAnual: string;
  medioPago: string;
  referenciaPago: string;
  observacion: string;
};

const todayYmd = () => new Date().toISOString().slice(0, 10);
const money = (value: number | string | null | undefined) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(Number(value ?? 0) || 0);

function safeErrorMessage(error: unknown, fallback: string): string {
  const data = typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response?.data
    : null;
  const message = String(data?.message ?? data?.error ?? '').trim();
  return !message || /sqlstate|stack trace|traceback|pdoexception|postgres|syntax error|\/(?:src|vendor|var)\//i.test(message)
    ? fallback
    : message;
}

function originLabel(origin: string) {
  if (origin === 'COMPLEMENTO') return 'Complemento';
  if (origin === 'EXCEPCION_INTERNA') return 'Excepción interna';
  return 'Plan';
}

function originBadge(origin: string) {
  if (origin === 'COMPLEMENTO') return 'bg-primary';
  if (origin === 'EXCEPCION_INTERNA') return 'bg-warning text-dark';
  return 'bg-secondary';
}

function complementAvailabilityMessage(item: EmpresaComplementoElegible): string {
  if (item.estado_comercial === 'BLOQUEADO_CAPACIDAD') {
    return `Requiere capacidad: ${item.capacidades_requeridas_faltantes.join(', ') || 'sin especificar'}.`;
  }
  if (item.estado_comercial === 'INCOMPATIBLE_PLAN') return 'No compatible con el plan actual.';
  if (item.estado_comercial === 'REQUIERE_DEPENDENCIA') return 'Requiere otro complemento activo.';
  if (item.estado_comercial === 'CATALOGO_INACTIVO') return 'Complemento no disponible.';
  if (item.estado_comercial === 'SIN_RECURSOS') return 'Complemento sin recursos configurados.';
  return item.estado_comercial || 'Complemento no disponible.';
}

function unavailableReasonLabel(reason: EmpresaPermisoNoDisponible['motivo']) {
  if (reason === 'NO_INCLUIDO_PLAN') return 'No incluido en el plan';
  if (reason === 'REQUIERE_COMPLEMENTO') return 'Requiere complemento';
  if (reason === 'RESTRINGIDO_EXCEPCION') return 'Restringido por excepción';
  return 'No disponible';
}

function EffectiveAccesses({
  modules, permissions, moduleCatalog, permissionCatalog,
}: {
  modules: EmpresaAccesoEfectivoModulo[];
  permissions: EmpresaAccesoEfectivoPermiso[];
  moduleCatalog: EmpresaModuloItem[];
  permissionCatalog: EmpresaPermisoItem[];
}) {
  const [expandedModule, setExpandedModule] = useState<number | 'unassigned' | null>(null);
  const catalogGroups = useMemo(() => buildPermissionGroups(permissionCatalog), [permissionCatalog]);
  const grouped = useMemo(() => {
    const assigned = new Set<number>();
    const catalogModules = new Map(moduleCatalog.map((item) => [item.id_modulo, item]));
    return {
      rows: modules.map((module) => {
        const catalogModule = catalogModules.get(module.id_modulo);
        const group = catalogModule ? findPermissionGroupForModule(catalogModule, catalogGroups) : null;
        const groupIds = new Set(group?.items.map((item) => item.id_permiso) ?? []);
        const items = permissions.filter((permission) => {
          if (!groupIds.has(permission.id_permiso)) return false;
          assigned.add(permission.id_permiso);
          return true;
        });
        return { module, permissions: items };
      }),
      unassigned: permissions.filter((permission) => !assigned.has(permission.id_permiso)),
    };
  }, [catalogGroups, moduleCatalog, modules, permissions]);

  if (!modules.length && !permissions.length) return <div className="text-muted small">No hay accesos comerciales efectivos.</div>;

  const toggle = (key: number | 'unassigned') => setExpandedModule((current) => current === key ? null : key);
  const renderPermissionDetails = (items: EmpresaAccesoEfectivoPermiso[]) => items.length === 0
    ? <div className="text-muted small">Este módulo no tiene permisos efectivos asociados.</div>
    : <div className="d-flex flex-wrap gap-2">{items.map((permission) => (
      <span key={permission.id_permiso} className="border rounded-pill px-2 py-1 small bg-light">
        <code>{permission.codigo}</code>
        <span className="ms-1 text-muted">{permission.nombre}</span>
        <span className={`badge ms-2 ${originBadge(permission.origen)}`}>{originLabel(permission.origen)}</span>
      </span>
    ))}</div>;

  return <div className="table-responsive border rounded">
    <table className="table table-sm align-middle mb-0">
      <thead><tr><th>Módulo</th><th style={{ width: 120 }}>Estado</th><th style={{ width: 150 }}>Permisos activos</th><th style={{ width: 135 }}>Origen</th><th style={{ width: 160 }}>Acciones</th></tr></thead>
      <tbody>
        {grouped.rows.map(({ module, permissions: modulePermissions }) => {
          const isExpanded = expandedModule === module.id_modulo;
          const detailsId = `commercial-permissions-${module.id_modulo}`;
          return <Fragment key={module.id_modulo}>
            <tr>
              <td><div className="fw-semibold">{module.nombre}</div><code className="small">{module.ruta || '-'}</code></td>
              <td><span className="badge bg-success">Activo</span></td>
              <td><span className="text-primary fw-semibold">{modulePermissions.length} efectivos</span></td>
              <td><span className={`badge ${originBadge(module.origen)}`}>{originLabel(module.origen)}</span></td>
              <td><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => toggle(module.id_modulo)} aria-label={`${isExpanded ? 'Ocultar permisos' : 'Ver permisos'} de ${module.nombre}`} aria-expanded={isExpanded} aria-controls={detailsId}>{isExpanded ? 'Ocultar permisos' : 'Ver permisos'}</button></td>
            </tr>
            {isExpanded && <tr id={detailsId}><td colSpan={5} className="bg-body-tertiary p-3">{renderPermissionDetails(modulePermissions)}</td></tr>}
          </Fragment>;
        })}
        {grouped.unassigned.length > 0 && (() => {
          const isExpanded = expandedModule === 'unassigned';
          const detailsId = 'commercial-permissions-unassigned';
          return <Fragment key="unassigned">
            <tr>
              <td><div className="fw-semibold">Otros permisos disponibles</div><span className="small text-muted">Sin módulo asociado</span></td>
              <td><span className="badge bg-success">Activo</span></td>
              <td><span className="text-primary fw-semibold">{grouped.unassigned.length} efectivos</span></td>
              <td><span className="badge bg-secondary">Mixto</span></td>
              <td><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => toggle('unassigned')} aria-label={`${isExpanded ? 'Ocultar permisos' : 'Ver permisos'} de Otros permisos disponibles`} aria-expanded={isExpanded} aria-controls={detailsId}>{isExpanded ? 'Ocultar permisos' : 'Ver permisos'}</button></td>
            </tr>
            {isExpanded && <tr id={detailsId}><td colSpan={5} className="bg-body-tertiary p-3">{renderPermissionDetails(grouped.unassigned)}</td></tr>}
          </Fragment>;
        })()}
      </tbody>
    </table>
  </div>;
}

function UnavailablePermissions({
  permissions, moduleCatalog, permissionCatalog,
}: {
  permissions: EmpresaPermisoNoDisponible[];
  moduleCatalog: EmpresaModuloItem[];
  permissionCatalog: EmpresaPermisoItem[];
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const catalogGroups = useMemo(() => buildPermissionGroups(permissionCatalog), [permissionCatalog]);
  const visualModuleByPermission = useMemo(() => {
    const result = new Map<number, EmpresaModuloItem>();
    moduleCatalog.forEach((module) => {
      const group = findPermissionGroupForModule(module, catalogGroups);
      group?.items.forEach((permission) => {
        if (!result.has(permission.id_permiso)) result.set(permission.id_permiso, module);
      });
    });
    return result;
  }, [catalogGroups, moduleCatalog]);
  const groups = useMemo(() => {
    type UnavailablePermissionGroup = { name: string; route: string | null; items: EmpresaPermisoNoDisponible[] };
    const grouped = new Map<string, UnavailablePermissionGroup>();
    permissions.forEach((permission) => {
      const visualModule = visualModuleByPermission.get(permission.id_permiso);
      const moduleId = permission.id_modulo_asociado ?? visualModule?.id_modulo ?? null;
      const key = moduleId === null ? 'unassigned' : `module-${moduleId}`;
      const current: UnavailablePermissionGroup = grouped.get(key) ?? {
        name: moduleId === null ? 'Otros permisos' : String(permission.grupo_ui_nombre ?? visualModule?.nombre ?? 'Permisos no disponibles'),
        route: visualModule?.ruta || permission.ruta_modulo_asociado,
        items: [],
      };
      current.items.push(permission);
      grouped.set(key, current);
    });
    return [...grouped.entries()].map(([key, group]) => ({
      ...group,
      key,
      items: [...group.items].sort((a, b) => a.orden_ui - b.orden_ui || a.codigo.localeCompare(b.codigo)),
    }));
  }, [permissions, visualModuleByPermission]);

  if (groups.length === 0) return <div className="text-muted small">No hay permisos comerciales no disponibles.</div>;

  return <div className="table-responsive border rounded">
    <table className="table table-sm align-middle mb-0">
      <thead><tr><th>Grupo</th><th style={{ width: 170 }}>Permisos</th><th style={{ width: 160 }}>Acciones</th></tr></thead>
      <tbody>{groups.map((group) => {
        const isExpanded = expandedGroup === group.key;
        const detailsId = `unavailable-permissions-${group.key}`;
        return <Fragment key={group.key}>
          <tr>
            <td><div className="fw-semibold">{group.name || 'Permisos no disponibles'}</div>{group.route && <code className="small">{group.route}</code>}</td>
            <td><span className="text-secondary fw-semibold">{group.items.length} no disponibles</span></td>
            <td><button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setExpandedGroup((current) => current === group.key ? null : group.key)} aria-label={`${isExpanded ? 'Ocultar permisos no disponibles' : 'Ver permisos no disponibles'} de ${group.name || 'este grupo'}`} aria-expanded={isExpanded} aria-controls={detailsId}>{isExpanded ? 'Ocultar permisos' : 'Ver permisos'}</button></td>
          </tr>
          {isExpanded && <tr id={detailsId}><td colSpan={3} className="bg-body-tertiary p-3"><div className="d-flex flex-wrap gap-2">{group.items.map((permission) => <span key={permission.id_permiso} className="border rounded-pill px-2 py-1 small bg-light"><code>{permission.codigo}</code><span className="ms-1 text-muted">{permission.nombre}</span><span className="badge text-bg-secondary ms-2">{unavailableReasonLabel(permission.motivo)}</span></span>)}</div></td></tr>}
        </Fragment>;
      })}</tbody>
    </table>
  </div>;
}

export default function CommercialAccessPanel({ idEmpresa, modulos, permisos }: Props) {
  const [accesses, setAccesses] = useState<EmpresaAccesosEfectivos | null>(null);
  const [exceptions, setExceptions] = useState<EmpresaEntitlementExcepcion[]>([]);
  const [eligible, setEligible] = useState<EmpresaComplementoElegible[]>([]);
  const [activations, setActivations] = useState<EmpresaComplementoActivacion[]>([]);
  const [catalog, setCatalog] = useState<SaasComplementoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<ActivationEditor | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [effective, exceptionList, eligibleList, activationList, catalogList] = await Promise.all([
        getEmpresaAccesosEfectivos(idEmpresa),
        getEmpresaEntitlementExcepciones(idEmpresa),
        getEmpresaComplementosElegibles(idEmpresa),
        getEmpresaComplementos(idEmpresa),
        getSaasComplementos(),
      ]);
      setAccesses(effective.accesos);
      setExceptions(exceptionList.items ?? []);
      setEligible(eligibleList.items ?? []);
      setActivations(activationList.items ?? []);
      setCatalog(catalogList.items ?? []);
    } catch (requestError) {
      setError(safeErrorMessage(requestError, 'No se pudo cargar la gestión comercial de esta empresa.'));
    } finally {
      setLoading(false);
    }
  }, [idEmpresa]);

  useEffect(() => { void refresh(); }, [refresh]);

  const activableComplements = useMemo(
    () => eligible.filter((item) => item.elegible && item.estado_activacion === null),
    [eligible],
  );
  const planIncludedComplements = useMemo(
    () => eligible.filter((item) => item.incluido_en_plan),
    [eligible],
  );
  const unavailableComplements = useMemo(
    () => eligible.filter((item) => !item.elegible && !item.incluido_en_plan && item.estado_activacion === null),
    [eligible],
  );
  const internalCatalog = useMemo(
    () => catalog.filter((item) => item.activo && item.tipo_comercial === 'SOLO_INTERNO'),
    [catalog],
  );

  const openActivation = (complemento: EmpresaComplementoElegible) => setEditor({
    complemento,
    ciclo: 'MENSUAL',
    fechaInicio: todayYmd(),
    fechaFin: '',
    valorMensual: String(complemento.valor_mensual),
    valorAnual: String(complemento.valor_anual),
    medioPago: '',
    referenciaPago: '',
    observacion: '',
  });

  const saveActivation = async () => {
    if (!editor) return;
    setSaving(true);
    try {
      await activateEmpresaComplemento(idEmpresa, editor.complemento.codigo, {
        ciclo_cobro: editor.ciclo,
        fecha_inicio: editor.fechaInicio,
        fecha_fin: editor.fechaFin || null,
        valor_mensual_acordado: Number(editor.valorMensual),
        valor_anual_acordado: Number(editor.valorAnual),
        medio_pago: editor.medioPago || undefined,
        referencia_pago: editor.referenciaPago || undefined,
        observacion: editor.observacion || undefined,
      });
      setEditor(null);
      await refresh();
      await Swal.fire({ icon: 'success', title: 'Complemento activado', text: 'Los accesos efectivos fueron actualizados.' });
    } catch (requestError) {
      await Swal.fire({ icon: 'error', title: 'No se pudo activar', text: safeErrorMessage(requestError, 'No se pudo activar el complemento.') });
    } finally { setSaving(false); }
  };

  const changeActivation = async (activation: EmpresaComplementoActivacion, action: 'deactivate' | 'restore') => {
    const deactivating = action === 'deactivate';
    const result = await Swal.fire({
      icon: deactivating ? 'warning' : 'question',
      title: `${deactivating ? 'Desactivar' : 'Restaurar'} ${activation.nombre}`,
      text: deactivating
        ? 'El historial se conservará, pero el complemento dejará de aportar accesos efectivos.'
        : 'Se restaurarán las condiciones comerciales congeladas de este complemento.',
      input: deactivating ? 'textarea' : undefined,
      inputLabel: deactivating ? 'Observación opcional' : undefined,
      showCancelButton: true,
      confirmButtonText: deactivating ? 'Desactivar' : 'Restaurar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    setSaving(true);
    try {
      if (deactivating) await deactivateEmpresaComplemento(idEmpresa, activation.codigo, String(result.value ?? '').trim() || undefined);
      else await restoreEmpresaComplemento(idEmpresa, activation.codigo);
      await refresh();
      await Swal.fire({ icon: 'success', title: deactivating ? 'Complemento desactivado' : 'Complemento restaurado', text: 'Los accesos efectivos fueron actualizados.' });
    } catch (requestError) {
      await Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: safeErrorMessage(requestError, 'No se pudo actualizar el complemento.') });
    } finally { setSaving(false); }
  };

  const updateInternal = async (item: SaasComplementoCatalogo, enabled: boolean) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: enabled ? `Habilitar internamente ${item.nombre}` : `Restringir internamente ${item.nombre}`,
      text: 'Este acceso es administrativo e interno; no es un complemento vendible.',
      input: 'textarea',
      inputLabel: 'Motivo obligatorio',
      inputValidator: (value) => String(value ?? '').trim().length >= 10 ? undefined : 'El motivo debe tener al menos 10 caracteres.',
      showCancelButton: true,
      confirmButtonText: enabled ? 'Habilitar internamente' : 'Restringir internamente',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    setSaving(true);
    try {
      await applyEmpresaExcepcionInterna(idEmpresa, item.codigo, { enabled, motivo: String(result.value).trim() });
      await refresh();
      await Swal.fire({ icon: 'success', title: 'Excepción interna actualizada', text: 'Los accesos efectivos fueron actualizados.' });
    } catch (requestError) {
      await Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: safeErrorMessage(requestError, 'No se pudo actualizar la excepción interna.') });
    } finally { setSaving(false); }
  };

  const subscription = accesses?.suscripcion;
  return <div>
    <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-3">
      <div><h5 className="mb-1">Accesos comerciales</h5><div className="text-muted small">Plan, complementos compatibles y excepciones internas auditadas.</div></div>
      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void refresh()} disabled={loading || saving}>{loading ? 'Actualizando...' : 'Actualizar'}</button>
    </div>

    {error && <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2" role="alert"><span>{error}</span><button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void refresh()} disabled={loading}>Reintentar</button></div>}
    {loading && !accesses ? <div className="py-4">Cargando accesos comerciales...</div> : accesses && <div className="row g-3">
      <div className="col-12"><div className="card"><div className="card-body py-3"><div className="fw-bold mb-2">Suscripción</div>
        {subscription ? <div className="row g-2 small">
          <div className="col-sm-6 col-lg-3"><span className="text-muted">Plan:</span> <b>{subscription.plan_nombre}</b></div>
          <div className="col-sm-6 col-lg-3"><span className="text-muted">Código:</span> <code>{subscription.plan_codigo}</code></div>
          <div className="col-sm-6 col-lg-3"><span className="text-muted">Estado:</span> <b>{subscription.estado}</b></div>
          <div className="col-sm-6 col-lg-3"><span className="text-muted">Ciclo:</span> <b>{subscription.ciclo}</b></div>
        </div> : <div className="text-muted small">La empresa no tiene una suscripción registrada.</div>}
      </div></div></div>

      <div className="col-12"><div className="card"><div className="card-body"><div className="fw-bold mb-3">Accesos efectivos por módulo</div>
        <EffectiveAccesses modules={accesses.modulos} permissions={accesses.permisos} moduleCatalog={modulos} permissionCatalog={permisos} />
      </div></div></div>

      <div className="col-12"><div className="card border-secondary"><div className="card-body"><div className="fw-bold">Permisos no disponibles</div><div className="text-muted small mb-3">Disponibilidad comercial resuelta por el backend según plan, complementos y excepciones.</div>
        <UnavailablePermissions permissions={accesses.permisos_no_disponibles} moduleCatalog={modulos} permissionCatalog={permisos} />
      </div></div></div>

      <div className="col-12 col-xl-6"><div className="card h-100"><div className="card-body">
        <div className="d-flex justify-content-between gap-2 mb-3"><div><div className="fw-bold">Complementos activables</div><div className="text-muted small">Solo opciones compatibles y elegibles según el backend.</div></div><span className="badge bg-primary d-inline-flex align-items-center justify-content-center align-self-start rounded" style={{ width: 32, height: 32 }}>{activableComplements.length}</span></div>
        {activableComplements.length === 0 ? <div className="text-muted small">No hay complementos comerciales compatibles para activar.</div> : <div className="vstack gap-2">{activableComplements.map((item) => <div key={item.codigo} className="border rounded p-2">
          <div className="d-flex justify-content-between gap-2"><div><div className="fw-semibold">{item.nombre}</div><code className="small">{item.codigo}</code></div><button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openActivation(item)} disabled={saving}>Activar</button></div>
          {item.descripcion && <div className="small text-muted mt-1">{item.descripcion}</div>}<div className="small mt-2">Mensual: <b>{money(item.valor_mensual)}</b> · Anual: <b>{money(item.valor_anual)}</b></div>
        </div>)}</div>}
      </div></div></div>

      <div className="col-12 col-xl-6"><div className="card h-100"><div className="card-body">
        <div className="fw-bold mb-1">Complementos activos e historial</div><div className="text-muted small mb-3">Los inactivos se conservan como historial y no aportan accesos efectivos.</div>
        {activations.length === 0 ? <div className="text-muted small">No hay activaciones comerciales registradas.</div> : <div className="vstack gap-2">{activations.map((item) => <div key={item.id_empresa_saas_complemento} className="border rounded p-2">
          <div className="d-flex justify-content-between align-items-start gap-2"><div><div className="fw-semibold">{item.nombre}</div><code className="small">{item.codigo}</code></div><span className={`badge ${item.efectiva ? 'bg-success' : 'bg-secondary'}`}>{item.efectiva ? 'Efectivo' : item.estado}</span></div>
          <div className="row g-1 small mt-1"><div className="col-sm-6">Ciclo: <b>{item.ciclo_cobro}</b></div><div className="col-sm-6">Inicio: <b>{item.fecha_inicio || '-'}</b></div><div className="col-sm-6">Valor congelado: <b>{money(item.ciclo_cobro === 'ANUAL' ? item.valor_anual_acordado : item.valor_mensual_acordado)}</b></div><div className="col-sm-6">Referencia: <b>{item.referencia_pago || '-'}</b></div></div>
          <div className="mt-2">{item.efectiva ? <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void changeActivation(item, 'deactivate')} disabled={saving}>Desactivar</button> : <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => void changeActivation(item, 'restore')} disabled={saving || !item.compatible}>Restaurar</button>}</div>
        </div>)}</div>}
      </div></div></div>

      <div className="col-12 col-xl-6"><div className="card h-100 border-success"><div className="card-body">
        <div className="d-flex justify-content-between gap-2 mb-3"><div><div className="fw-bold">Incluidos con el plan</div><div className="text-muted small">Complementos cubiertos por la suscripción actual.</div></div><span className="badge bg-success d-inline-flex align-items-center justify-content-center align-self-start rounded" style={{ width: 32, height: 32 }}>{planIncludedComplements.length}</span></div>
        {planIncludedComplements.length === 0 ? <div className="text-muted small">No hay complementos adicionales cubiertos por este plan.</div> : <div className="vstack gap-2">{planIncludedComplements.map((item) => <div key={item.codigo} className="border rounded p-2 d-flex justify-content-between align-items-start gap-2"><div><div className="fw-semibold">{item.nombre}</div><code className="small">{item.codigo}</code>{item.descripcion && <div className="small text-muted mt-1">{item.descripcion}</div>}<div className="small text-success mt-2">Este complemento ya está cubierto por el plan actual.</div></div><span className="badge bg-success">Incluido</span></div>)}</div>}
      </div></div></div>

      <div className="col-12 col-xl-6"><div className="card h-100 border-secondary"><div className="card-body">
        <div className="d-flex justify-content-between gap-2 mb-3"><div><div className="fw-bold">Complementos no disponibles</div><div className="text-muted small">Estado comercial informado por el backend.</div></div><span className="badge bg-secondary d-inline-flex align-items-center justify-content-center align-self-start rounded" style={{ width: 32, height: 32 }}>{unavailableComplements.length}</span></div>
        {unavailableComplements.length === 0 ? <div className="text-muted small">No hay complementos comerciales bloqueados o incompatibles.</div> : <div className="vstack gap-2">{unavailableComplements.map((item) => <div key={item.codigo} className="border rounded p-2"><div className="fw-semibold">{item.nombre}</div><code className="small">{item.codigo}</code>{item.descripcion && <div className="small text-muted mt-1">{item.descripcion}</div>}<div className="small text-secondary mt-2">{complementAvailabilityMessage(item)}</div></div>)}</div>}
      </div></div></div>

      <div className="col-12"><div className="card border-warning"><div className="card-body"><div className="fw-bold">Excepciones internas auditadas</div><div className="text-muted small mb-3">Uso administrativo interno. No son complementos vendibles.</div>
        {internalCatalog.length === 0 ? <div className="text-muted small">No hay catálogos internos disponibles.</div> : <div className="vstack gap-2">{internalCatalog.map((item) => <div key={item.codigo} className="border rounded p-2 d-flex justify-content-between align-items-start gap-2 flex-wrap"><div><div className="fw-semibold">{item.nombre}</div><code className="small">{item.codigo}</code>{item.descripcion && <div className="small text-muted mt-1">{item.descripcion}</div>}</div><div className="d-flex gap-2"><button type="button" className="btn btn-outline-success btn-sm" onClick={() => void updateInternal(item, true)} disabled={saving}>Habilitar internamente</button><button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void updateInternal(item, false)} disabled={saving}>Restringir internamente</button></div></div>)}</div>}
        {exceptions.length > 0 && <div className="table-responsive mt-3"><table className="table table-sm align-middle mb-0"><thead><tr><th>Recurso</th><th>Estado</th><th>Motivo</th><th>Actor</th><th>Actualización</th></tr></thead><tbody>{exceptions.map((item) => <tr key={item.id_excepcion}><td><b>{item.tipo === 'MODULO' ? item.recurso.nombre : item.recurso.codigo || item.recurso.nombre}</b><div className="small text-muted">{item.tipo}</div></td><td><span className={`badge ${item.enabled ? 'bg-success' : 'bg-secondary'}`}>{item.estado}</span></td><td>{item.motivo}</td><td>{item.actor.email || '-'}</td><td>{item.updated_at || item.created_at || '-'}</td></tr>)}</tbody></table></div>}
      </div></div></div>
    </div>}

    {editor && <><div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="commercial-complement-editor-title"><div className="modal-dialog modal-lg"><div className="modal-content">
      <div className="modal-header"><h5 id="commercial-complement-editor-title" className="modal-title">Activar {editor.complemento.nombre}</h5><button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setEditor(null)} disabled={saving} /></div>
      <div className="modal-body"><div className="row g-3">
        <div className="col-md-4"><label className="form-label" htmlFor="complement-cycle">Ciclo</label><select id="complement-cycle" className="form-select" value={editor.ciclo} onChange={(event) => setEditor((current) => current ? { ...current, ciclo: event.target.value as 'MENSUAL' | 'ANUAL' } : current)} disabled={saving}><option value="MENSUAL">Mensual</option><option value="ANUAL">Anual</option></select></div>
        <div className="col-md-4"><label className="form-label" htmlFor="complement-start">Fecha inicio</label><input id="complement-start" className="form-control" type="date" value={editor.fechaInicio} onChange={(event) => setEditor((current) => current ? { ...current, fechaInicio: event.target.value } : current)} disabled={saving} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="complement-end">Fecha fin</label><input id="complement-end" className="form-control" type="date" value={editor.fechaFin} onChange={(event) => setEditor((current) => current ? { ...current, fechaFin: event.target.value } : current)} disabled={saving} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="complement-monthly">Valor mensual acordado</label><input id="complement-monthly" className="form-control" type="number" min="0" step="0.01" value={editor.valorMensual} onChange={(event) => setEditor((current) => current ? { ...current, valorMensual: event.target.value } : current)} disabled={saving} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="complement-yearly">Valor anual acordado</label><input id="complement-yearly" className="form-control" type="number" min="0" step="0.01" value={editor.valorAnual} onChange={(event) => setEditor((current) => current ? { ...current, valorAnual: event.target.value } : current)} disabled={saving} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="complement-payment-method">Medio de pago</label><input id="complement-payment-method" className="form-control" value={editor.medioPago} onChange={(event) => setEditor((current) => current ? { ...current, medioPago: event.target.value } : current)} disabled={saving} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="complement-payment-reference">Referencia de pago</label><input id="complement-payment-reference" className="form-control" value={editor.referenciaPago} onChange={(event) => setEditor((current) => current ? { ...current, referenciaPago: event.target.value } : current)} disabled={saving} /></div>
        <div className="col-12"><label className="form-label" htmlFor="complement-observation">Observación</label><textarea id="complement-observation" className="form-control" rows={3} value={editor.observacion} onChange={(event) => setEditor((current) => current ? { ...current, observacion: event.target.value } : current)} disabled={saving} /></div>
      </div></div>
      <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" onClick={() => setEditor(null)} disabled={saving}>Cancelar</button><button type="button" className="btn btn-primary" onClick={() => void saveActivation()} disabled={saving || !editor.fechaInicio || Number(editor.valorMensual) < 0 || Number(editor.valorAnual) < 0}>{saving ? 'Activando...' : 'Activar complemento'}</button></div>
    </div></div></div><div className="modal-backdrop show" /></>}
  </div>;
}
