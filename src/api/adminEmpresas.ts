// src/api/adminEmpresas.ts
import adminClient from './adminClient';
import type { SyncResult } from './adminSaas';

export type Empresa = {
  id_empresa: number;
  nombre: string;
  codigo?: string | null;
  nit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  usuarios_emails?: string | null;
  codigo_departamento?: string | null;
  departamento_nombre?: string | null;
  codigo_municipio?: string | null;
  municipio_nombre?: string | null;
  barrio?: string | null;
  estado: number;
  tipo_negocio?: TipoNegocio;
  created_at?: string;
  updated_at?: string;
};

export type TipoNegocio =
  | 'GENERAL'
  | 'DROGUERIA'
  | 'TIENDA_MINIMARKET'
  | 'TECNOLOGIA_SERVICIO_TECNICO';

export type TipoNegocioOption = {
  value: TipoNegocio;
  label: string;
  help: string;
};

export const TIPO_NEGOCIO_OPTIONS: TipoNegocioOption[] = [
  {
    value: 'GENERAL',
    label: 'Otro negocio',
    help: 'Configuracion general para negocios que no requieren una plantilla especializada.',
  },
  {
    value: 'DROGUERIA',
    label: 'Droguería',
    help: 'Plantilla para droguerias con lotes, vencimientos y venta por presentaciones.',
  },
  {
    value: 'TIENDA_MINIMARKET',
    label: 'Tienda / minimarket',
    help: 'Plantilla para tiendas, minimarkets y operacion de productos de consumo.',
  },
  {
    value: 'TECNOLOGIA_SERVICIO_TECNICO',
    label: 'Tecnología y servicio técnico',
    help: 'Plantilla para venta de tecnologia, recepcion de equipos y servicios tecnicos.',
  },
];

export const TIPO_NEGOCIO_LABELS: Record<TipoNegocio, string> = Object.fromEntries(
  TIPO_NEGOCIO_OPTIONS.map((option) => [option.value, option.label])
) as Record<TipoNegocio, string>;

export type EmpresaCategoriaNegocio = {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  perfil_operativo: TipoNegocio;
  activo: boolean;
  visible_publico: boolean;
  orden: number;
};

export type CodigoCapacidad = 'LOTES_VENCIMIENTOS' | 'PRODUCTOS_PRESENTACION' | 'PRODUCTOS_PESO';

export type EmpresaCapacidadDetalle = {
  codigo_capacidad: CodigoCapacidad | string;
  nombre: string;
  descripcion?: string | null;
  estado: number;
  enabled: boolean;
  gestion?: 'EMPRESA' | 'SAAS';
  editable_por_empresa?: boolean;
};


export type EmpresaTenantMapping = {
  modo?: string | null;
  db_host?: string | null;
  db_port?: string | number | null;
  db_name?: string | null;
  db_schema?: string | null;
  db_user?: string | null;
  estado?: string | null;
  notas?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
export type EmpresaConfiguracionNegocio = {
  ok: boolean;
  id_empresa: number;
  nombre: string;
  tipo_negocio: TipoNegocio;
  categoria_negocio?: string | null;
  categorias_disponibles?: EmpresaCategoriaNegocio[];
  capacidades: Record<string, boolean>;
  capacidades_detalle: EmpresaCapacidadDetalle[];
  tenant?: EmpresaTenantMapping | null;
};

export async function listEmpresas(params?: { q?: string; limit?: number; offset?: number }) {
  const { data } = await adminClient.get('/admin/empresas', { params });
  return data as { ok: boolean; total: number; items: Empresa[]; limit: number; offset: number; q: string };
}

export async function setEmpresaEstado(idEmpresa: number, estado: 0 | 1) {
  const { data } = await adminClient.patch(`/admin/empresas/${idEmpresa}/estado`, { estado });
  return data as { ok: boolean; item: Empresa };
}

export async function getEmpresaConfiguracionNegocio(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/configuracion-negocio`);
  return data as EmpresaConfiguracionNegocio;
}

export async function saveEmpresaConfiguracionNegocio(
  idEmpresa: number,
  payload: { categoria_negocio: string; capacidades: Record<string, boolean> }
) {
  const { data } = await adminClient.put(`/admin/empresas/${idEmpresa}/configuracion-negocio`, payload);
  return data as EmpresaConfiguracionNegocio;
}

export async function downloadInventarioInicialTemplate(idEmpresa: number) {
  const response = await adminClient.get(`/admin/empresas/${idEmpresa}/inventario-import/plantilla`, {
    responseType: 'blob',
  });
  const disposition = String(response.headers['content-disposition'] || '');
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `plantilla_inventario_inicial_empresa_${idEmpresa}.xlsx`;

  const url = window.URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export type InventarioImportIssue = {
  row: number | null;
  field?: string | null;
  message: string;
};

export type InventarioImportPreviewItem = {
  row: number;
  status: 'OK' | 'ERROR' | string;
  nombre: string;
  sku?: string;
  codigo_barras?: string;
  precio?: string;
  stock?: string;
  tipo_cantidad?: string;
  errors: string[];
  warnings: string[];
};

export type InventarioImportPreview = {
  ok: boolean;
  id_empresa: number;
  filename: string;
  summary: {
    rows_read: number;
    valid_rows: number;
    rows_with_errors: number;
    errors: number;
    warnings: number;
    can_confirm: boolean;
  };
  errors: InventarioImportIssue[];
  warnings: InventarioImportIssue[];
  items: InventarioImportPreviewItem[];
};

export async function previewInventarioInicialImport(idEmpresa: number, file: File) {
  const form = new FormData();
  form.append('archivo', file);
  const { data } = await adminClient.post(`/admin/empresas/${idEmpresa}/inventario-import/preview`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as InventarioImportPreview;
}

export type InventarioImportConfirm = {
  ok: boolean;
  message?: string;
  id_empresa?: number;
  id_inicial?: number;
  summary?: {
    productos_creados: number;
    inventarios_creados: number;
    lotes_creados: number;
    presentaciones_creadas: number;
    movimientos_creados: number;
  };
  preview?: InventarioImportPreview;
};

export async function confirmInventarioInicialImport(idEmpresa: number, file: File) {
  const form = new FormData();
  form.append('archivo', file);
  const { data } = await adminClient.post(`/admin/empresas/${idEmpresa}/inventario-import/confirm`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as InventarioImportConfirm;
}

export type EmpresaModuloItem = {
  id_modulo: number;
  nombre: string;
  ruta: string;
  icono?: string | null;
  orden: number;
  parent_id?: number | null;
  estado: number;
  id_permiso_gate?: number | null;
  enabled: boolean;
};

export async function getEmpresaModulos(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/modulos`);
  return data as { ok: boolean; id_empresa: number; items: EmpresaModuloItem[] };
}

export async function saveEmpresaModulos(idEmpresa: number, items: Array<{ id_modulo: number; enabled: boolean }>) {
  const { data } = await adminClient.put(`/admin/empresas/${idEmpresa}/modulos`, { items });
  return data as { ok: boolean; id_empresa: number; saved: number; sync?: SyncResult };
}

export type EmpresaPermisoItem = {
  id_permiso: number;
  codigo: string;
  descripcion: string;
  enabled: boolean;
  grupo_ui?: string | null;
  grupo_ui_nombre?: string | null;
  orden_ui?: number | string | null;
  visible_ui?: boolean | number | string | null;
};

export async function getEmpresaPermisos(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/permisos`);
  return data as { ok: boolean; id_empresa: number; items: EmpresaPermisoItem[] };
}

export async function saveEmpresaPermisos(idEmpresa: number, items: Array<{ id_permiso: number; enabled: boolean }>) {
  const { data } = await adminClient.put(`/admin/empresas/${idEmpresa}/permisos`, { items });
  return data as { ok: boolean; id_empresa: number; saved: number; sync?: SyncResult };
}

export type EmpresaUsuarioItem = {
  id_usuario: number;
  id_empresa: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  documento?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  estado: number;
  created_at?: string;
  updated_at?: string;
};

export async function getEmpresaUsuarios(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/usuarios`);
  return data as { ok: boolean; id_empresa: number; items: EmpresaUsuarioItem[] };
}

export type EmpresaAdminUsuarioItem = {
  id_usuario: number;
  id_empresa: number;
  nombre: string;
  apellido?: string | null;
  email: string;
  estado: number;
};

export async function getEmpresaUsuarioAdmin(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/usuario-admin`);
  return data as { ok: boolean; id_empresa: number; item: EmpresaAdminUsuarioItem };
}

export type EntitlementOrigin = 'PLAN' | 'COMPLEMENTO' | 'EXCEPCION_INTERNA' | string;

export type EmpresaAccesoEfectivoModulo = {
  id_modulo: number;
  ruta: string;
  nombre: string;
  origen: EntitlementOrigin;
};

export type EmpresaAccesoEfectivoPermiso = {
  id_permiso: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  grupo_ui: string;
  grupo_ui_nombre: string;
  orden_ui: number;
  id_modulo_asociado: number | null;
  ruta_modulo_asociado: string | null;
  origen: EntitlementOrigin;
};

export type MotivoPermisoNoDisponible =
  | 'NO_INCLUIDO_PLAN'
  | 'REQUIERE_COMPLEMENTO'
  | 'RESTRINGIDO_EXCEPCION'
  | 'NO_DISPONIBLE';

export type EmpresaPermisoNoDisponible = {
  id_permiso: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  grupo_ui: string;
  grupo_ui_nombre: string;
  orden_ui: number;
  id_modulo_asociado: number | null;
  ruta_modulo_asociado: string | null;
  motivo: MotivoPermisoNoDisponible;
};

export type EmpresaEntitlementExcepcion = {
  id_excepcion: number;
  id_empresa?: number;
  tipo: 'MODULO' | 'PERMISO';
  id_modulo?: number | null;
  id_permiso?: number | null;
  recurso: {
    ruta?: string;
    codigo?: string;
    nombre: string;
  };
  enabled: boolean;
  estado: 'HABILITADA' | 'RESTRINGIDA';
  motivo: string;
  actor: {
    id_superadmin: number | null;
    email: string | null;
  };
  created_at: string | null;
  updated_at: string | null;
};

export type EmpresaAccesosEfectivos = {
  modo_entitlements: 'legacy' | 'plans';
  suscripcion: {
    id_plan: number;
    plan_codigo: string;
    plan_nombre: string;
    estado: string;
    ciclo: string;
  } | null;
  modulos: EmpresaAccesoEfectivoModulo[];
  permisos: EmpresaAccesoEfectivoPermiso[];
  permisos_no_disponibles: EmpresaPermisoNoDisponible[];
  modulos_agrupados?: Record<string, EmpresaAccesoEfectivoModulo[]>;
  permisos_agrupados?: Record<string, EmpresaAccesoEfectivoPermiso[]>;
  complementos?: EmpresaComplementoActivacion[];
  excepciones: EmpresaEntitlementExcepcion[];
  capacidades_efectivas: unknown[];
};

export async function getEmpresaAccesosEfectivos(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/accesos-efectivos`);
  return data as { ok: boolean; id_empresa: number; accesos: EmpresaAccesosEfectivos };
}

export async function getEmpresaEntitlementExcepciones(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/entitlement-excepciones`);
  return data as { ok: boolean; id_empresa: number; items: EmpresaEntitlementExcepcion[] };
}

export type EmpresaComplementoElegible = {
  id_complemento: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  tipo_comercial: 'COMPLEMENTO' | 'SOLO_INTERNO' | string;
  valor_mensual: number;
  valor_anual: number;
  plan_actual?: string;
  compatible: boolean;
  dependencias_cumplidas: boolean;
  estado_activacion?: string | null;
  elegible: boolean;
  estado_comercial:
    | 'ACTIVABLE'
    | 'INCLUIDO_EN_PLAN'
    | 'BLOQUEADO_CAPACIDAD'
    | 'INCOMPATIBLE_PLAN'
    | 'REQUIERE_DEPENDENCIA'
    | 'CATALOGO_INACTIVO'
    | 'SIN_RECURSOS'
    | string;
  incluido_en_plan: boolean;
  recursos: {
    modulos: { total: number; incluidos_en_plan: number; adicionales: number };
    permisos: { total: number; incluidos_en_plan: number; adicionales: number };
    capacidades: { total: number; incluidos_en_plan: number; adicionales: number };
  };
  capacidades_requeridas_faltantes: string[];
};

export type EmpresaComplementoActivacion = {
  id_empresa_saas_complemento: number;
  codigo: string;
  nombre: string;
  tipo_comercial: 'COMPLEMENTO' | 'SOLO_INTERNO' | string;
  estado: string;
  compatible: boolean;
  efectiva: boolean;
  valor_mensual_acordado: number;
  valor_anual_acordado: number;
  ciclo_cobro: 'MENSUAL' | 'ANUAL' | string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  medio_pago: string | null;
  referencia_pago: string | null;
  observacion: string | null;
  actor: { id_superadmin: number | null; email: string | null };
  created_at: string | null;
  updated_at: string | null;
};

export type SaasComplementoCatalogo = Omit<EmpresaComplementoElegible,
  | 'plan_actual'
  | 'compatible'
  | 'dependencias_cumplidas'
  | 'estado_activacion'
  | 'elegible'
  | 'estado_comercial'
  | 'incluido_en_plan'
  | 'recursos'
  | 'capacidades_requeridas_faltantes'
> & {
  planes_compatibles?: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type ActivateEmpresaComplementoPayload = {
  ciclo_cobro: 'MENSUAL' | 'ANUAL';
  fecha_inicio?: string;
  fecha_fin?: string | null;
  valor_mensual_acordado: number;
  valor_anual_acordado: number;
  medio_pago?: string;
  referencia_pago?: string;
  observacion?: string;
};

export async function getEmpresaComplementosElegibles(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/complementos/elegibles`);
  return data as { ok: boolean; id_empresa: number; items: EmpresaComplementoElegible[] };
}

export async function getEmpresaComplementos(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/complementos`);
  return data as { ok: boolean; id_empresa: number; items: EmpresaComplementoActivacion[] };
}

export async function getSaasComplementos() {
  const { data } = await adminClient.get('/admin/saas/complementos');
  return data as { ok: boolean; items: SaasComplementoCatalogo[] };
}

export async function activateEmpresaComplemento(
  idEmpresa: number,
  codigo: string,
  payload: ActivateEmpresaComplementoPayload,
) {
  const { data } = await adminClient.put(`/admin/empresas/${idEmpresa}/complementos/${codigo}`, payload);
  return data as { ok: boolean; item: EmpresaComplementoActivacion };
}

export async function deactivateEmpresaComplemento(idEmpresa: number, codigo: string, observacion?: string) {
  const { data } = await adminClient.patch(`/admin/empresas/${idEmpresa}/complementos/${codigo}/desactivar`, { observacion });
  return data as { ok: boolean; item: EmpresaComplementoActivacion };
}

export async function restoreEmpresaComplemento(idEmpresa: number, codigo: string, observacion?: string) {
  const { data } = await adminClient.patch(`/admin/empresas/${idEmpresa}/complementos/${codigo}/restaurar`, { observacion });
  return data as { ok: boolean; item: EmpresaComplementoActivacion };
}

export async function applyEmpresaExcepcionInterna(
  idEmpresa: number,
  codigo: string,
  payload: { enabled: boolean; motivo: string },
) {
  const { data } = await adminClient.put(`/admin/empresas/${idEmpresa}/excepciones-internas/${codigo}`, payload);
  return data as { ok: boolean; item: { modulos: number; permisos: number; capacidades: number } };
}
