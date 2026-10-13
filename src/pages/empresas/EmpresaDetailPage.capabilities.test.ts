import { describe, expect, it } from 'vitest';
import type { EmpresaCapacidadDetalle } from '../../api/adminEmpresas';
import { isBusinessCapabilityEditable } from './businessCapabilities';

function capability(overrides: Partial<EmpresaCapacidadDetalle>): EmpresaCapacidadDetalle {
  return {
    codigo_capacidad: overrides.codigo_capacidad ?? 'LOTES_VENCIMIENTOS',
    nombre: overrides.nombre ?? 'Lotes y vencimientos',
    descripcion: overrides.descripcion ?? null,
    estado: overrides.estado ?? 1,
    enabled: overrides.enabled ?? false,
    ...overrides,
  };
}

describe('empresa business capabilities presentation', () => {
  it('keeps company-editable operational capabilities visible', () => {
    expect(isBusinessCapabilityEditable(capability({ gestion: 'EMPRESA', editable_por_empresa: true }))).toBe(true);
  });

  it('hides SaaS capabilities managed by plan or subscription', () => {
    expect(isBusinessCapabilityEditable(capability({
      codigo_capacidad: 'PRECONTABILIDAD',
      gestion: 'SAAS',
      editable_por_empresa: false,
    }))).toBe(false);
  });

  it('hides non-editable capabilities even without gestion metadata', () => {
    expect(isBusinessCapabilityEditable(capability({ editable_por_empresa: false }))).toBe(false);
  });
});
