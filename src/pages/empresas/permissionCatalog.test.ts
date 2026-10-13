import { describe, expect, it } from 'vitest';
import type { EmpresaModuloItem, EmpresaPermisoItem } from '../../api/adminEmpresas';
import {
  buildPermissionGroups,
  findPermissionGroupForModule,
  unmatchedPermissionGroups,
} from './permissionCatalog';

function perm(overrides: Partial<EmpresaPermisoItem>): EmpresaPermisoItem {
  return {
    id_permiso: overrides.id_permiso ?? 1,
    codigo: overrides.codigo ?? 'X__VER',
    descripcion: overrides.descripcion ?? 'Demo',
    enabled: overrides.enabled ?? true,
    ...overrides,
  };
}

function module(overrides: Partial<EmpresaModuloItem>): EmpresaModuloItem {
  return {
    id_modulo: overrides.id_modulo ?? 1,
    nombre: overrides.nombre ?? 'Compras',
    ruta: overrides.ruta ?? '/compras',
    orden: overrides.orden ?? 1,
    estado: overrides.estado ?? 1,
    enabled: overrides.enabled ?? true,
    ...overrides,
  };
}

describe('permission catalog presentation', () => {
  it('groups COMPRAS__CORREGIR_CONFIRMADA under Compras from API metadata', () => {
    const groups = buildPermissionGroups([
      perm({
        codigo: 'COMPRAS__CORREGIR_CONFIRMADA',
        grupo_ui: 'COMPRAS',
        grupo_ui_nombre: 'Compras',
        orden_ui: 40,
      }),
    ]);

    const compras = findPermissionGroupForModule(module({ nombre: 'Mis Compras', ruta: '/compras' }), groups);

    expect(compras?.label).toBe('Compras');
    expect(compras?.items.map((item) => item.codigo)).toEqual(['COMPRAS__CORREGIR_CONFIRMADA']);
  });

  it('keeps future OTROS permissions visible in unmatched groups', () => {
    const groups = buildPermissionGroups([
      perm({ codigo: 'FUTURO__VER', grupo_ui: 'OTROS', grupo_ui_nombre: 'Otros permisos' }),
    ]);

    expect(unmatchedPermissionGroups([module({ nombre: 'Compras', ruta: '/compras' })], groups)).toEqual([
      expect.objectContaining({
        key: 'OTROS',
        label: 'Otros permisos',
        items: [expect.objectContaining({ codigo: 'FUTURO__VER' })],
      }),
    ]);
  });

  it('does not render permissions with visible_ui=false', () => {
    const groups = buildPermissionGroups([
      perm({ codigo: 'OCULTO__VER', grupo_ui: 'OCULTO', visible_ui: false }),
    ]);

    expect(groups).toEqual([]);
  });

  it('uses safe metadata defaults when backend response has no editorial fields', () => {
    const groups = buildPermissionGroups([
      perm({ codigo: 'LEGACY__VER' }),
    ]);

    expect(groups).toEqual([
      expect.objectContaining({
        key: 'OTROS',
        label: 'Otros permisos',
        order: 1000,
        items: [expect.objectContaining({ codigo: 'LEGACY__VER', visible_ui: true, orden_ui: 1000 })],
      }),
    ]);
  });
});
