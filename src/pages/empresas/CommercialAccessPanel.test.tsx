import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Swal from 'sweetalert2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateEmpresaComplemento,
  deactivateEmpresaComplemento,
  getEmpresaAccesosEfectivos,
  getEmpresaComplementos,
  getEmpresaComplementosElegibles,
  getEmpresaEntitlementExcepciones,
  getSaasComplementos,
} from '../../api/adminEmpresas';
import CommercialAccessPanel from './CommercialAccessPanel';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn(() => Promise.resolve({ isConfirmed: true })) } }));
vi.mock('../../api/adminEmpresas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/adminEmpresas')>();
  return {
    ...actual,
    getEmpresaAccesosEfectivos: vi.fn(), getEmpresaEntitlementExcepciones: vi.fn(),
    getEmpresaComplementosElegibles: vi.fn(), getEmpresaComplementos: vi.fn(), getSaasComplementos: vi.fn(),
    activateEmpresaComplemento: vi.fn(), deactivateEmpresaComplemento: vi.fn(), restoreEmpresaComplemento: vi.fn(),
    applyEmpresaExcepcionInterna: vi.fn(),
  };
});

const accessMock = vi.mocked(getEmpresaAccesosEfectivos);
const exceptionsMock = vi.mocked(getEmpresaEntitlementExcepciones);
const eligibleMock = vi.mocked(getEmpresaComplementosElegibles);
const activationsMock = vi.mocked(getEmpresaComplementos);
const catalogMock = vi.mocked(getSaasComplementos);
const activateMock = vi.mocked(activateEmpresaComplemento);
const deactivateMock = vi.mocked(deactivateEmpresaComplemento);
const swalMock = vi.mocked(Swal.fire);

const modules = [{ id_modulo: 1, nombre: 'Pos', ruta: '/pos', orden: 1, estado: 1, enabled: true }];
const permissions = [
  { id_permiso: 11, codigo: 'VENTA__VER', descripcion: 'Ver ventas', enabled: true, grupo_ui: 'POS', grupo_ui_nombre: 'Pos', orden_ui: 1, visible_ui: true },
  { id_permiso: 12, codigo: 'WHATSAPP__POS_ENVIAR_COMPROBANTE', descripcion: 'Enviar por WhatsApp', enabled: false, grupo_ui: 'POS', grupo_ui_nombre: 'Pos', orden_ui: 2, visible_ui: true },
];
const commercialEligibility = {
  estado_comercial: 'ACTIVABLE' as const,
  incluido_en_plan: false,
  recursos: {
    modulos: { total: 0, incluidos_en_plan: 0, adicionales: 0 },
    permisos: { total: 1, incluidos_en_plan: 0, adicionales: 1 },
    capacidades: { total: 0, incluidos_en_plan: 0, adicionales: 0 },
  },
  capacidades_requeridas_faltantes: [],
};

function accessResponse(origin: 'PLAN' | 'COMPLEMENTO' = 'PLAN') {
  return {
    ok: true, id_empresa: 2,
    accesos: {
      modo_entitlements: 'plans' as const,
      suscripcion: { id_plan: 1, plan_codigo: 'ESSENTIAL', plan_nombre: 'Essential', estado: 'ACTIVA', ciclo: 'MENSUAL' },
      modulos: [{ id_modulo: 1, nombre: 'Pos', ruta: '/pos', origen: 'PLAN' as const }],
      permisos: [
        { id_permiso: 11, codigo: 'VENTA__VER', nombre: 'Ver ventas', descripcion: 'Ver ventas', grupo_ui: 'POS', grupo_ui_nombre: 'Pos', orden_ui: 1, id_modulo_asociado: 1, ruta_modulo_asociado: '/pos', origen: 'PLAN' as const },
        ...(origin === 'COMPLEMENTO' ? [{ id_permiso: 12, codigo: 'WHATSAPP__POS_ENVIAR_COMPROBANTE', nombre: 'Enviar por WhatsApp', descripcion: 'Enviar por WhatsApp', grupo_ui: 'POS', grupo_ui_nombre: 'Pos', orden_ui: 2, id_modulo_asociado: 1, ruta_modulo_asociado: '/pos', origen: 'COMPLEMENTO' as const }] : []),
      ],
      permisos_no_disponibles: [],
      excepciones: [], capacidades_efectivas: [],
    },
  };
}

describe('CommercialAccessPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.mockResolvedValue(accessResponse());
    exceptionsMock.mockResolvedValue({ ok: true, id_empresa: 2, items: [] });
    eligibleMock.mockResolvedValue({ ok: true, id_empresa: 2, items: [
      { id_complemento: 1, codigo: 'WHATSAPP_POS', nombre: 'WhatsApp POS', activo: true, tipo_comercial: 'COMPLEMENTO', valor_mensual: 10000, valor_anual: 100000, compatible: true, dependencias_cumplidas: true, elegible: true, estado_activacion: null, ...commercialEligibility },
      { id_complemento: 2, codigo: 'WHATSAPP_SOPORTE', nombre: 'WhatsApp Soporte', activo: true, tipo_comercial: 'COMPLEMENTO', valor_mensual: 10000, valor_anual: 100000, compatible: false, dependencias_cumplidas: true, elegible: false, estado_activacion: null, ...commercialEligibility, estado_comercial: 'INCOMPATIBLE_PLAN' },
    ] });
    activationsMock.mockResolvedValue({ ok: true, id_empresa: 2, items: [] });
    catalogMock.mockResolvedValue({ ok: true, items: [
      { id_complemento: 9, codigo: 'PRECONTABILIDAD_INTERNA', nombre: 'Precontabilidad', activo: true, tipo_comercial: 'SOLO_INTERNO', valor_mensual: 0, valor_anual: 0 },
    ] });
    activateMock.mockResolvedValue({ ok: true, item: {} as never });
    deactivateMock.mockResolvedValue({ ok: true, item: {} as never });
  });

  it('muestra Essential con solo recursos efectivos base y no activa complementos incompatibles', async () => {
    render(<CommercialAccessPanel idEmpresa={2} modulos={modules} permisos={permissions} />);
    expect(await screen.findByText('Essential')).toBeInTheDocument();
    expect(screen.queryByText('VENTA__VER')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver permisos de Pos' }));
    expect(await screen.findByText('VENTA__VER')).toBeInTheDocument();
    expect(screen.queryByText('WHATSAPP__POS_ENVIAR_COMPROBANTE')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Activar' })).toHaveLength(1);
    expect(screen.getByText('WhatsApp Soporte')).toBeInTheDocument();
    expect(screen.getByText('No compatible con el plan actual.')).toBeInTheDocument();
  });

  it('muestra un complemento incluido en plan sin permitir activarlo', async () => {
    eligibleMock.mockResolvedValue({ ok: true, id_empresa: 2, items: [{
      id_complemento: 3, codigo: 'WHATSAPP_POS', nombre: 'WhatsApp POS', activo: true, tipo_comercial: 'COMPLEMENTO', valor_mensual: 10000, valor_anual: 100000, compatible: true, dependencias_cumplidas: true, elegible: false, estado_activacion: null, ...commercialEligibility, estado_comercial: 'INCLUIDO_EN_PLAN', incluido_en_plan: true,
    }] });
    render(<CommercialAccessPanel idEmpresa={2} modulos={modules} permisos={permissions} />);
    expect(await screen.findByText('Incluidos con el plan')).toBeInTheDocument();
    expect(screen.getByText('Este complemento ya está cubierto por el plan actual.')).toBeInTheDocument();
    expect(screen.getByText('Incluido')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });

  it('muestra bloqueo por capacidad sin ofrecer activación', async () => {
    eligibleMock.mockResolvedValue({ ok: true, id_empresa: 2, items: [{
      id_complemento: 4, codigo: 'WHATSAPP_SOPORTE', nombre: 'WhatsApp soporte', activo: true, tipo_comercial: 'COMPLEMENTO', valor_mensual: 10000, valor_anual: 100000, compatible: true, dependencias_cumplidas: true, elegible: false, estado_activacion: null, ...commercialEligibility, estado_comercial: 'BLOQUEADO_CAPACIDAD', capacidades_requeridas_faltantes: ['SOPORTE_TECNICO'],
    }] });
    render(<CommercialAccessPanel idEmpresa={2} modulos={modules} permisos={permissions} />);
    expect(await screen.findByText('Complementos no disponibles')).toBeInTheDocument();
    expect(screen.getByText('Requiere capacidad: SOPORTE_TECNICO.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });

  it('solo mantiene abierto un módulo de permisos a la vez', async () => {
    accessMock.mockResolvedValue({
      ok: true, id_empresa: 2,
      accesos: {
        ...accessResponse().accesos,
        modulos: [
          { id_modulo: 1, nombre: 'Pos', ruta: '/pos', origen: 'PLAN' as const },
          { id_modulo: 2, nombre: 'Clientes', ruta: '/clientes', origen: 'PLAN' as const },
        ],
        permisos: [
          { id_permiso: 11, codigo: 'VENTA__VER', nombre: 'Ver ventas', descripcion: 'Ver ventas', grupo_ui: 'POS', grupo_ui_nombre: 'Pos', orden_ui: 1, id_modulo_asociado: 1, ruta_modulo_asociado: '/pos', origen: 'PLAN' as const },
          { id_permiso: 12, codigo: 'CLIENTES__VER', nombre: 'Ver clientes', descripcion: 'Ver clientes', grupo_ui: 'CLIENTES', grupo_ui_nombre: 'Clientes', orden_ui: 2, id_modulo_asociado: 2, ruta_modulo_asociado: '/clientes', origen: 'PLAN' as const },
        ],
      },
    });
    const moduleCatalog = [...modules, { id_modulo: 2, nombre: 'Clientes', ruta: '/clientes', orden: 2, estado: 1, enabled: true }];
    const permissionCatalog = [...permissions, { id_permiso: 12, codigo: 'CLIENTES__VER', descripcion: 'Ver clientes', enabled: true, grupo_ui: 'CLIENTES', grupo_ui_nombre: 'Clientes', orden_ui: 2, visible_ui: true }];
    render(<CommercialAccessPanel idEmpresa={2} modulos={moduleCatalog} permisos={permissionCatalog} />);
    await screen.findByText('Essential');

    fireEvent.click(screen.getByRole('button', { name: 'Ver permisos de Pos' }));
    expect(await screen.findByText('VENTA__VER')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver permisos de Clientes' }));

    expect(await screen.findByText('CLIENTES__VER')).toBeInTheDocument();
    expect(screen.queryByText('VENTA__VER')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver permisos de Pos' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Ocultar permisos de Clientes' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('separa Otros permisos disponibles de los permisos no disponibles resueltos por backend', async () => {
    accessMock.mockResolvedValue({
      ok: true, id_empresa: 2,
      accesos: {
        ...accessResponse().accesos,
        permisos: [{ id_permiso: 30, codigo: 'REPORTES__VER', nombre: 'Ver reportes', descripcion: 'Ver reportes', grupo_ui: 'OTROS', grupo_ui_nombre: 'Otros permisos', orden_ui: 30, id_modulo_asociado: null, ruta_modulo_asociado: null, origen: 'PLAN' as const }],
        permisos_no_disponibles: [{ id_permiso: 40, codigo: 'FACTURACION__ELECTRONICA_EMITIR', nombre: 'Emitir factura electrónica', descripcion: 'Emitir documentos fiscales', grupo_ui: 'FACTURACION_ELECTRONICA', grupo_ui_nombre: 'Facturación electrónica', orden_ui: 40, id_modulo_asociado: 20, ruta_modulo_asociado: '/facturacion-electronica', motivo: 'REQUIERE_COMPLEMENTO' as const }],
      },
    });
    render(<CommercialAccessPanel idEmpresa={2} modulos={modules} permisos={permissions} />);
    await screen.findByText('Otros permisos disponibles');
    fireEvent.click(screen.getByRole('button', { name: 'Ver permisos de Otros permisos disponibles' }));
    expect(await screen.findByText('REPORTES__VER')).toBeInTheDocument();

    expect(screen.getByText('Permisos no disponibles')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver permisos no disponibles de Facturación electrónica' }));
    expect(await screen.findByText('FACTURACION__ELECTRONICA_EMITIR')).toBeInTheDocument();
    expect(screen.getByText('Requiere complemento')).toBeInTheDocument();
  });

  it('agrupa Compras, Gastos y Precontabilidad bajo sus módulos aunque backend no les asocie un módulo', async () => {
    accessMock.mockResolvedValue({
      ok: true, id_empresa: 2,
      accesos: {
        ...accessResponse().accesos,
        permisos_no_disponibles: [
          { id_permiso: 51, codigo: 'COMPRAS__CREAR', nombre: 'Crear compras', descripcion: 'Crear compras', grupo_ui: 'COMPRAS', grupo_ui_nombre: 'Compras', orden_ui: 10, id_modulo_asociado: null, ruta_modulo_asociado: null, motivo: 'NO_INCLUIDO_PLAN' as const },
          { id_permiso: 52, codigo: 'GASTOS__CREAR', nombre: 'Crear gastos', descripcion: 'Crear gastos', grupo_ui: 'GASTOS', grupo_ui_nombre: 'Gastos', orden_ui: 20, id_modulo_asociado: null, ruta_modulo_asociado: null, motivo: 'NO_INCLUIDO_PLAN' as const },
          { id_permiso: 53, codigo: 'PRECONTABILIDAD__CONFIGURAR', nombre: 'Configurar precontabilidad', descripcion: 'Configurar precontabilidad', grupo_ui: 'PRECONTABILIDAD', grupo_ui_nombre: 'Precontabilidad', orden_ui: 30, id_modulo_asociado: null, ruta_modulo_asociado: null, motivo: 'NO_INCLUIDO_PLAN' as const },
        ],
      },
    });
    const moduleCatalog = [
      ...modules,
      { id_modulo: 12, nombre: 'Mis Compras', ruta: '/compras', orden: 2, estado: 1, enabled: false },
      { id_modulo: 15, nombre: 'Gastos', ruta: '/gastos', orden: 3, estado: 1, enabled: false },
      { id_modulo: 17, nombre: 'Precontabilidad', ruta: '/precontabilidad', orden: 4, estado: 1, enabled: false },
    ];
    const permissionCatalog = [
      ...permissions,
      { id_permiso: 51, codigo: 'COMPRAS__CREAR', descripcion: 'Crear compras', enabled: false, grupo_ui: 'COMPRAS', grupo_ui_nombre: 'Compras', orden_ui: 10, visible_ui: true },
      { id_permiso: 52, codigo: 'GASTOS__CREAR', descripcion: 'Crear gastos', enabled: false, grupo_ui: 'GASTOS', grupo_ui_nombre: 'Gastos', orden_ui: 20, visible_ui: true },
      { id_permiso: 53, codigo: 'PRECONTABILIDAD__CONFIGURAR', descripcion: 'Configurar precontabilidad', enabled: false, grupo_ui: 'PRECONTABILIDAD', grupo_ui_nombre: 'Precontabilidad', orden_ui: 30, visible_ui: true },
    ];
    render(<CommercialAccessPanel idEmpresa={2} modulos={moduleCatalog} permisos={permissionCatalog} />);
    await screen.findByText('Permisos no disponibles');

    fireEvent.click(screen.getByRole('button', { name: 'Ver permisos no disponibles de Compras' }));
    expect(await screen.findByText('COMPRAS__CREAR')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver permisos no disponibles de Gastos' }));
    expect(await screen.findByText('GASTOS__CREAR')).toBeInTheDocument();
    expect(screen.queryByText('COMPRAS__CREAR')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver permisos no disponibles de Precontabilidad' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver permisos no disponibles de Otros permisos' })).not.toBeInTheDocument();
  });

  it('activa WHATSAPP_POS y vuelve a consultar los accesos efectivos con su nuevo origen', async () => {
    accessMock.mockResolvedValueOnce(accessResponse()).mockResolvedValue(accessResponse('COMPLEMENTO'));
    render(<CommercialAccessPanel idEmpresa={2} modulos={modules} permisos={permissions} />);
    await screen.findByText('Essential');
    fireEvent.click(screen.getByRole('button', { name: 'Activar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Activar complemento' }));

    await waitFor(() => expect(activateMock).toHaveBeenCalledWith(2, 'WHATSAPP_POS', expect.objectContaining({ ciclo_cobro: 'MENSUAL' })));
    fireEvent.click(screen.getByRole('button', { name: 'Ver permisos de Pos' }));
    expect(await screen.findByText('WHATSAPP__POS_ENVIAR_COMPROBANTE')).toBeInTheDocument();
    expect(screen.getAllByText('Complemento').length).toBeGreaterThan(0);
    expect(accessMock).toHaveBeenCalledTimes(2);
  });

  it('mantiene el complemento desactivado como histórico y lo deja de consultar como efectivo', async () => {
    const active = {
      id_empresa_saas_complemento: 5, codigo: 'WHATSAPP_POS', nombre: 'WhatsApp POS', tipo_comercial: 'COMPLEMENTO', estado: 'ACTIVO', compatible: true, efectiva: true,
      valor_mensual_acordado: 10000, valor_anual_acordado: 100000, ciclo_cobro: 'MENSUAL', fecha_inicio: '2026-11-02', fecha_fin: null,
      medio_pago: null, referencia_pago: 'PAGO-1', observacion: null, actor: { id_superadmin: 1, email: 'admin@test' }, created_at: null, updated_at: null,
    };
    accessMock.mockResolvedValueOnce(accessResponse('COMPLEMENTO')).mockResolvedValueOnce(accessResponse());
    activationsMock
      .mockResolvedValueOnce({ ok: true, id_empresa: 2, items: [active] })
      .mockResolvedValueOnce({ ok: true, id_empresa: 2, items: [{ ...active, estado: 'INACTIVO', efectiva: false }] });
    render(<CommercialAccessPanel idEmpresa={2} modulos={modules} permisos={permissions} />);
    await screen.findAllByText('WhatsApp POS');
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith(2, 'WHATSAPP_POS', undefined));
    expect(await screen.findByText('INACTIVO')).toBeInTheDocument();
    expect(screen.queryByText('WHATSAPP__POS_ENVIAR_COMPROBANTE')).not.toBeInTheDocument();
    expect(accessMock).toHaveBeenCalledTimes(2);
  });

  it('expone Precontabilidad únicamente como excepción interna', async () => {
    render(<CommercialAccessPanel idEmpresa={2} modulos={modules} permisos={permissions} />);
    expect(await screen.findByText('PRECONTABILIDAD_INTERNA')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Habilitar internamente' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar Precontabilidad' })).not.toBeInTheDocument();
    expect(swalMock).not.toHaveBeenCalled();
  });
});
