import type { EmpresaCapacidadDetalle } from '../../api/adminEmpresas';

export function isBusinessCapabilityEditable(capability: EmpresaCapacidadDetalle): boolean {
  return capability.editable_por_empresa !== false && capability.gestion !== 'SAAS';
}
