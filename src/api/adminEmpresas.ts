// src/api/adminEmpresas.ts
import adminClient from './adminClient';

export type Empresa = {
  id_empresa: number;
  nombre: string;
  codigo?: string | null;
  nit?: string | null;
  direccion?: string | null;
  telefono?: string | null;
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

export type TipoNegocio = 'GENERAL' | 'DROGUERIA' | 'TIENDA_MINIMARKET';
export type CodigoCapacidad = 'LOTES_VENCIMIENTOS' | 'PRODUCTOS_PRESENTACION' | 'PRODUCTOS_PESO';

export type EmpresaCapacidadDetalle = {
  codigo_capacidad: CodigoCapacidad | string;
  nombre: string;
  descripcion?: string | null;
  estado: number;
  enabled: boolean;
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
  payload: { tipo_negocio: TipoNegocio; capacidades: Record<string, boolean> }
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
  return data as { ok: boolean; id_empresa: number; saved: number };
}

export type EmpresaPermisoItem = { id_permiso: number; codigo: string; descripcion: string; enabled: boolean };

export async function getEmpresaPermisos(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/permisos`);
  return data as { ok: boolean; id_empresa: number; items: EmpresaPermisoItem[] };
}

export async function saveEmpresaPermisos(idEmpresa: number, items: Array<{ id_permiso: number; enabled: boolean }>) {
  const { data } = await adminClient.put(`/admin/empresas/${idEmpresa}/permisos`, { items });
  return data as { ok: boolean; id_empresa: number; saved: number };
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
