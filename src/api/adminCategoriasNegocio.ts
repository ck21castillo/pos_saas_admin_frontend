import adminClient from './adminClient';

export type CapacidadInicial = {
  codigo_capacidad: string;
  habilitada_por_defecto: boolean;
};

export type PerfilOperativoCatalogItem = {
  codigo: string;
  nombre?: string | null;
  descripcion?: string | null;
};

export type CapacidadNegocioCatalogItem = {
  codigo_capacidad: string;
  nombre?: string | null;
  descripcion?: string | null;
  activo?: boolean | number | string | null;
};

export type CategoriaNegocio = {
  id?: number;
  id_categoria?: number;
  id_categoria_negocio?: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  perfil_operativo?: string | null;
  activo: boolean | number;
  visible_publico: boolean | number;
  orden: number;
  capacidades_iniciales?: CapacidadInicial[] | Record<string, unknown> | null;
};

export type CategoriaNegocioPayload = {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  perfil_operativo: string | null;
  activo: boolean;
  visible_publico: boolean;
  orden: number;
  capacidades_iniciales: CapacidadInicial[];
};

export type CategoriaNegocioUpdatePayload = Omit<CategoriaNegocioPayload, 'codigo'>;

export type CategoriasNegocioResponse = {
  ok: boolean;
  items: CategoriaNegocio[];
  perfiles_operativos?: PerfilOperativoCatalogItem[];
  capacidades?: CapacidadNegocioCatalogItem[];
  capacidades_disponibles?: CapacidadNegocioCatalogItem[];
  catalogos?: {
    perfiles_operativos?: PerfilOperativoCatalogItem[];
    capacidades?: CapacidadNegocioCatalogItem[];
  };
};

export function categoriaNegocioId(item: CategoriaNegocio): number | null {
  const value = item.id_categoria_negocio ?? item.id_categoria ?? item.id;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function listarCategoriasNegocio() {
  const { data } = await adminClient.get('/admin/categorias-negocio');
  return data as CategoriasNegocioResponse;
}

export async function crearCategoriaNegocio(payload: CategoriaNegocioPayload) {
  const { data } = await adminClient.post('/admin/categorias-negocio', payload);
  return data as { ok: boolean; item: CategoriaNegocio };
}

export async function actualizarCategoriaNegocio(idCategoria: number, payload: CategoriaNegocioUpdatePayload) {
  const { data } = await adminClient.put(`/admin/categorias-negocio/${idCategoria}`, payload);
  return data as { ok: boolean; item: CategoriaNegocio };
}
