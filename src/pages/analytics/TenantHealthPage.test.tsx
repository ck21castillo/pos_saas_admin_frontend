import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Swal from 'sweetalert2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TenantHealthPage from './TenantHealthPage';
import { getTenantHealth, listTenantHealth, type TenantHealthItem } from '../../api/adminTenantHealth';

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
  },
}));

vi.mock('../../api/adminTenantHealth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/adminTenantHealth')>();
  return {
    ...actual,
    listTenantHealth: vi.fn(),
    getTenantHealth: vi.fn(),
  };
});

const listTenantHealthMock = vi.mocked(listTenantHealth);
const getTenantHealthMock = vi.mocked(getTenantHealth);
const swalFireMock = vi.mocked(Swal.fire);

function item(overrides: Partial<TenantHealthItem>): TenantHealthItem {
  return {
    id_empresa: 1,
    empresa_nombre: 'Bersano Demo',
    empresa_estado: 1,
    tipo_negocio: 'GENERAL',
    tenant: { db_name: 'tenant_demo', estado: 'ACTIVE' },
    health_status: 'OK',
    inspection: {
      state: 'FRESH',
      source: 'SNAPSHOT',
      checked_at: '2026-10-04T12:00:00Z',
      ttl_seconds: 300,
      persisted: true,
    },
    connection_ms: 8,
    check_ms: 12,
    db_size_bytes: 1024,
    db_size: '1 MB',
    counts: {
      producto: 4,
      inventario: 3,
      venta: 2,
      venta_detalle: 2,
      compra: 1,
      movimientos_inventario: 1,
    },
    recent: {
      ventas_30d: 2,
      total_ventas_30d: 120000,
      compras_30d: 1,
    },
    top_tables: [],
    warnings: [],
    errors: [],
    checked_at: '2026-10-04T12:00:00Z',
    ...overrides,
  };
}

function listResponse(items: TenantHealthItem[]) {
  return {
    ok: true,
    snapshot_supported: true,
    snapshot_ttl_seconds: 300,
    total: items.length,
    limit: 25,
    offset: 0,
    q: '',
    summary: {
      ok: items.filter((row) => row.health_status === 'OK').length,
      warning: items.filter((row) => row.health_status === 'WARNING').length,
      error: items.filter((row) => row.health_status === 'ERROR').length,
      pending: items.filter((row) => row.health_status === 'PENDING').length,
    },
    items,
  };
}

async function renderWithList(items: TenantHealthItem[]) {
  listTenantHealthMock.mockResolvedValueOnce(listResponse(items));
  render(<TenantHealthPage />);
  await screen.findByText('Bersano Demo');
}

describe('TenantHealthPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra listado PENDING como aun sin verificacion y no consulta detalle por fila', async () => {
    await renderWithList([
      item({
        health_status: 'PENDING',
        inspection: {
          state: 'PENDING',
          source: 'NOT_CHECKED',
          checked_at: null,
          ttl_seconds: 300,
          persisted: false,
        },
      }),
    ]);

    expect(screen.getByText('Sin verificacion')).toBeInTheDocument();
    expect(screen.getByText('Aun sin verificacion')).toBeInTheDocument();
    expect(screen.getByText('Pendientes')).toBeInTheDocument();
    expect(getTenantHealthMock).not.toHaveBeenCalled();
  });

  it('muestra snapshot FRESH con el estado de salud recibido', async () => {
    await renderWithList([
      item({
        health_status: 'OK',
        inspection: {
          state: 'FRESH',
          source: 'SNAPSHOT',
          checked_at: '2026-10-04T13:00:00Z',
          ttl_seconds: 300,
          persisted: true,
        },
      }),
    ]);

    expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
    expect(screen.getByText('Vigente')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-04 13:00:00/)).toBeInTheDocument();
  });

  it('muestra snapshot STALE como informacion vencida conservando salud visible', async () => {
    await renderWithList([
      item({
        health_status: 'WARNING',
        warnings: ['Conteos antiguos'],
        inspection: {
          state: 'STALE',
          source: 'SNAPSHOT',
          checked_at: '2026-10-01T10:00:00Z',
          ttl_seconds: 300,
          persisted: true,
        },
      }),
    ]);

    expect(screen.getByText('Alerta')).toBeInTheDocument();
    expect(screen.getByText('Vencida')).toBeInTheDocument();
  });

  it('abre detalle rapido con deep=0 y actualiza la fila local', async () => {
    await renderWithList([item({ id_empresa: 7 })]);
    getTenantHealthMock.mockResolvedValueOnce({
      ok: true,
      item: item({
        id_empresa: 7,
        check_ms: 30,
        inspection: {
          state: 'FRESH',
          source: 'DIRECT',
          checked_at: '2026-10-04T14:00:00Z',
          deep: false,
          persisted: true,
        },
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Detalle' }));

    await waitFor(() => expect(getTenantHealthMock).toHaveBeenCalledWith(7, false));
    expect(await screen.findByText(/Origen:/)).toBeInTheDocument();
    expect(screen.getByText('DIRECT')).toBeInTheDocument();
    expect(screen.getByText('30 ms')).toBeInTheDocument();
  });

  it('ejecuta diagnostico profundo solo bajo accion explicita', async () => {
    await renderWithList([item({ id_empresa: 9 })]);
    getTenantHealthMock.mockResolvedValueOnce({
      ok: true,
      item: item({
        id_empresa: 9,
        inspection: {
          state: 'FRESH',
          source: 'DIRECT',
          checked_at: '2026-10-04T14:00:00Z',
          deep: false,
          persisted: true,
        },
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Detalle' }));
    await waitFor(() => expect(getTenantHealthMock).toHaveBeenCalledWith(9, false));
    getTenantHealthMock.mockClear();

    getTenantHealthMock.mockResolvedValueOnce({
      ok: true,
      item: item({
        id_empresa: 9,
        inspection: {
          state: 'FRESH',
          source: 'DIRECT',
          checked_at: '2026-10-04T15:00:00Z',
          deep: true,
          persisted: true,
        },
      }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Diagnostico profundo' }));

    await waitFor(() => expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Diagnostico profundo',
    })));
    await waitFor(() => expect(getTenantHealthMock).toHaveBeenCalledWith(9, true));
  });
});
