import { describe, expect, it } from 'vitest';
import { SAAS_MANAGED_CAPABILITY_ORDER } from './adminSaas';

describe('SaaS commercial capabilities', () => {
  it('keeps electronic invoicing as a commercial capability, separate from fiscal RBAC permissions', () => {
    expect(SAAS_MANAGED_CAPABILITY_ORDER).toContain('FACTURACION_ELECTRONICA');
    expect(SAAS_MANAGED_CAPABILITY_ORDER).not.toContain('FACTURACION__ELECTRONICA_VER');
    expect(SAAS_MANAGED_CAPABILITY_ORDER).not.toContain('FACTURACION__ELECTRONICA_CONFIGURAR');
    expect(SAAS_MANAGED_CAPABILITY_ORDER).not.toContain('FACTURACION__ELECTRONICA_EMITIR');
    expect(SAAS_MANAGED_CAPABILITY_ORDER).not.toContain('FACTURACION__ELECTRONICA_DOCUMENTOS_VER');
  });
});
