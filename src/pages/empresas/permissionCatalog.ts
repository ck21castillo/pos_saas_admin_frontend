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

function searchTokens(value: unknown): string[] {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token)) ?? [];
}

function moduleSearchText(module: EmpresaModuloItem): string {
  return [module.nombre, module.ruta]
    .map(searchKey)
    .filter(Boolean)
    .join(' ');
}

function permissionGroupMatchScore(module: EmpresaModuloItem, group: PermissionGroup): number {
  const groupKey = searchKey(group.key);
  const groupLabel = searchKey(group.label);
  const routeLeaf = searchKey(String(module.ruta ?? '').split('/').filter(Boolean).pop() ?? '');
  const nameText = searchKey(module.nombre);
  const moduleText = moduleSearchText(module);
  const moduleTokens = new Set([...searchTokens(module.nombre), ...searchTokens(module.ruta)]);
  const groupTokens = searchTokens(group.key);

  if (!groupKey) return 0;
  const matchingTokens = groupTokens.filter((token) => moduleTokens.has(token));
  if (groupTokens.length > 0 && matchingTokens.length === groupTokens.length) {
    return 10000 + groupTokens.length * 100 + groupKey.length;
  }
  if (routeLeaf === groupKey) return 7000 + groupKey.length;
  if (routeLeaf.startsWith(groupKey)) return 6000 + groupKey.length;
  if (groupKey.startsWith(routeLeaf) && routeLeaf) return 5000 + routeLeaf.length;
  if (nameText === groupKey) return 4000 + groupKey.length;
  if (nameText.startsWith(groupKey)) return 3000 + groupKey.length;
  if (nameText.includes(groupKey)) return 2000 + groupKey.length;
  if (moduleText.includes(groupKey)) return 1000 + groupKey.length;
  if (groupLabel && (nameText.includes(groupLabel) || groupLabel.includes(nameText))) return 500 + groupLabel.length;
  return 0;
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
  return groups
    .map((group) => ({ group, score: permissionGroupMatchScore(module, group) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.group.order - b.group.order || a.group.key.localeCompare(b.group.key))
    .at(0)?.group ?? null;
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
