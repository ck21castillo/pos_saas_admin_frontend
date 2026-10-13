import type { EmpresaModuloItem, EmpresaPermisoItem } from '../../api/adminEmpresas';

export const EXTRA_PERMISSION_GROUPS_KEY = '__extra_permission_groups__';
export const DEFAULT_PERMISSION_GROUP_KEY = 'OTROS';
export const DEFAULT_PERMISSION_GROUP_LABEL = 'Otros permisos';
export const DEFAULT_PERMISSION_ORDER = 1000;

export type PermissionGroup = {
  key: string;
  label: string;
  order: number;
  items: EmpresaPermisoItem[];
};

function boolValue(value: EmpresaPermisoItem['visible_ui']): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 't', 'true', 'yes', 'si', 'on'].includes(value.trim().toLowerCase());
}

function numericOrder(value: EmpresaPermisoItem['orden_ui']): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : DEFAULT_PERMISSION_ORDER;
}

export function permissionGroupKey(value: unknown): string {
  const text = String(value ?? '').trim().toUpperCase();
  return text || DEFAULT_PERMISSION_GROUP_KEY;
}

export function normalizePermissionItem(item: EmpresaPermisoItem): EmpresaPermisoItem {
  const key = permissionGroupKey(item.grupo_ui);
  const label = String(item.grupo_ui_nombre ?? '').trim() || DEFAULT_PERMISSION_GROUP_LABEL;
  return {
    ...item,
    grupo_ui: key,
    grupo_ui_nombre: label,
    orden_ui: numericOrder(item.orden_ui),
    visible_ui: boolValue(item.visible_ui),
  };
}

function searchKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function moduleSearchText(module: EmpresaModuloItem): string {
  return [module.nombre, module.ruta]
    .map(searchKey)
    .filter(Boolean)
    .join(' ');
}

export function buildPermissionGroups(items: EmpresaPermisoItem[]): PermissionGroup[] {
  const map = new Map<string, PermissionGroup>();
  for (const raw of items) {
    const item = normalizePermissionItem(raw);
    if (!item.visible_ui) continue;

    const key = permissionGroupKey(item.grupo_ui);
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      existing.order = Math.min(existing.order, numericOrder(item.orden_ui));
      continue;
    }

    map.set(key, {
      key,
      label: String(item.grupo_ui_nombre ?? '').trim() || DEFAULT_PERMISSION_GROUP_LABEL,
      order: numericOrder(item.orden_ui),
      items: [item],
    });
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => {
        const byOrder = numericOrder(a.orden_ui) - numericOrder(b.orden_ui);
        return byOrder || String(a.codigo).localeCompare(String(b.codigo));
      }),
    }))
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

export function findPermissionGroupForModule(
  module: EmpresaModuloItem,
  groups: PermissionGroup[],
): PermissionGroup | null {
  const moduleText = moduleSearchText(module);
  const routeLeaf = searchKey(String(module.ruta ?? '').split('/').filter(Boolean).pop() ?? '');
  const nameText = searchKey(module.nombre);

  return groups.find((group) => {
    const groupKey = searchKey(group.key);
    const groupLabel = searchKey(group.label);
    if (!groupKey) return false;
    return moduleText.includes(groupKey)
      || (routeLeaf !== '' && groupKey.includes(routeLeaf))
      || (nameText !== '' && groupLabel.includes(nameText))
      || (groupLabel !== '' && nameText.includes(groupLabel));
  }) ?? null;
}

export function unmatchedPermissionGroups(
  modules: EmpresaModuloItem[],
  groups: PermissionGroup[],
): PermissionGroup[] {
  const matched = new Set(
    modules
      .map((module) => findPermissionGroupForModule(module, groups)?.key)
      .filter((key): key is string => Boolean(key))
  );
  return groups.filter((group) => !matched.has(group.key));
}
