// src/api/adminEmpresas.ts
import adminClient from './adminClient';

export type Empresa = {
  id_empresa: number;
  nombre: string;
  estado: number;
  created_at?: string;
  updated_at?: string;
};

export async function listEmpresas(params?: { q?: string; limit?: number; offset?: number }) {
  const { data } = await adminClient.get('/admin/empresas', { params });
  return data as { ok: boolean; total: number; items: Empresa[]; limit: number; offset: number; q: string };
}

export async function setEmpresaEstado(idEmpresa: number, estado: 0 | 1) {
  const { data } = await adminClient.patch(`/admin/empresas/${idEmpresa}/estado`, { estado });
  return data as { ok: boolean; item: Empresa };
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
