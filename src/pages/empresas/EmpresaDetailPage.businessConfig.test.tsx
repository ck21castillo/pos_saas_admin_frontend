import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Swal from 'sweetalert2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEmpresaConfiguracionNegocio,
  getEmpresaModulos,
  getEmpresaPermisos,
  getEmpresaUsuarios,
  saveEmpresaConfiguracionNegocio,
  type EmpresaConfiguracionNegocio,
} from '../../api/adminEmpresas';
import EmpresaDetailPage from './EmpresaDetailPage';

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
  },
}));

vi.mock('../../api/adminEmpresas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/adminEmpresas')>();
  return {
    ...actual,
    getEmpresaModulos: vi.fn(),
    saveEmpresaModulos: vi.fn(),
    getEmpresaPermisos: vi.fn(),
    saveEmpresaPermisos: vi.fn(),
    getEmpresaUsuarios: vi.fn(),
    getEmpresaConfiguracionNegocio: vi.fn(),
    saveEmpresaConfiguracionNegocio: vi.fn(),
    downloadInventarioInicialTemplate: vi.fn(),
    previewInventarioInicialImport: vi.fn(),
    confirmInventarioInicialImport: vi.fn(),
  };
});

vi.mock('../../api/adminTenantHealth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/adminTenantHealth')>();
  return {
    ...actual,
    getTenantHealth: vi.fn(),
  };
});

const getEmpresaModulosMock = vi.mocked(getEmpresaModulos);
const getEmpresaPermisosMock = vi.mocked(getEmpresaPermisos);
const getEmpresaUsuariosMock = vi.mocked(getEmpresaUsuarios);
const getEmpresaConfiguracionNegocioMock = vi.mocked(getEmpresaConfiguracionNegocio);
const saveEmpresaConfiguracionNegocioMock = vi.mocked(saveEmpresaConfiguracionNegocio);
const swalFireMock = vi.mocked(Swal.fire);

function businessConfig(overrides: Partial<EmpresaConfiguracionNegocio> = {}): EmpresaConfiguracionNegocio {
  return {
    ok: true,
    id_empresa: 2,
    nombre: 'CRISKE',
    tipo_negocio: 'TECNOLOGIA_SERVICIO_TECNICO',
    categoria_negocio: 'TECNOLOGIA_SERVICIO_TECNICO',
    categorias_disponibles: [
      {
        codigo: 'TECNOLOGIA_SERVICIO_TECNICO',
        nombre: 'Tecnologia y servicio tecnico',
        descripcion: 'Venta y servicio tecnico.',
        perfil_operativo: 'TECNOLOGIA_SERVICIO_TECNICO',
        activo: true,
        visible_publico: true,
        orden: 10,
      },
    ],
    capacidades: {
      LOTES_VENCIMIENTOS: true,
      PRODUCTOS_PESO: true,
      PRODUCTOS_PRESENTACION: true,
      SERIALES_EN_VENTA: true,
    },
    capacidades_detalle: [
      {
        codigo_capacidad: 'LOTES_VENCIMIENTOS',
        nombre: 'Lotes y vencimientos',
        descripcion: 'Control de lotes.',
        estado: 1,
        enabled: true,
        gestion: 'EMPRESA',
        editable_por_empresa: true,
      },
      {
        codigo_capacidad: 'PRODUCTOS_PESO',
        nombre: 'Productos por peso',
        descripcion: 'Venta e inventario por peso.',
        estado: 1,
        enabled: true,
        gestion: 'EMPRESA',
        editable_por_empresa: true,
      },
      {
        codigo_capacidad: 'PRODUCTOS_PRESENTACION',
        nombre: 'Productos por presentación',
        descripcion: 'Presentaciones por producto.',
        estado: 1,
        enabled: true,
        gestion: 'EMPRESA',
        editable_por_empresa: true,
      },
      {
        codigo_capacidad: 'SERIALES_EN_VENTA',
        nombre: 'Seriales e IMEI en ventas',
        descripcion: 'Seriales e IMEI en operaciones de venta.',
        estado: 1,
        enabled: true,
        gestion: 'EMPRESA',
        editable_por_empresa: true,
      },
    ],
    tenant: null,
    ...overrides,
  };
}

function backendError(message: string): unknown {
  return {
    response: {
      status: 422,
      data: { message },
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/empresas/2']}>
      <Routes>
        <Route path="/empresas/:id" element={<EmpresaDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

async function capabilityCheckbox(labelText: string) {
  const label = await screen.findByText(labelText);
  const row = label.closest('tr');
  expect(row).not.toBeNull();
  return within(row as HTMLTableRowElement).getByRole('checkbox');
}

async function lotesCheckbox() {
  return capabilityCheckbox('Lotes y vencimientos');
}

describe('EmpresaDetailPage business configuration save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEmpresaModulosMock.mockResolvedValue({ ok: true, items: [] });
    getEmpresaPermisosMock.mockResolvedValue({ ok: true, items: [] });
    getEmpresaUsuariosMock.mockResolvedValue({ ok: true, items: [] });
    getEmpresaConfiguracionNegocioMock.mockResolvedValue(businessConfig());
    saveEmpresaConfiguracionNegocioMock.mockResolvedValue(businessConfig());
  });

  it('guarda la configuracion de negocio correctamente', async () => {
    renderPage();

    const checkbox = await lotesCheckbox();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(saveEmpresaConfiguracionNegocioMock).toHaveBeenCalledWith(2, {
      categoria_negocio: 'TECNOLOGIA_SERVICIO_TECNICO',
      capacidades: {
        LOTES_VENCIMIENTOS: false,
        PRODUCTOS_PESO: true,
        PRODUCTOS_PRESENTACION: true,
        SERIALES_EN_VENTA: true,
      },
    }));
    await waitFor(() => expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      title: 'Guardado',
    })));
  });

  it('restaura datos y muestra advertencia cuando Lotes esta en uso', async () => {
    saveEmpresaConfiguracionNegocioMock.mockRejectedValue(backendError('CAPACIDAD_LOTES_EN_USO'));

    renderPage();

    const checkbox = await lotesCheckbox();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(getEmpresaConfiguracionNegocioMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No se puede desactivar Lotes y vencimientos porque esta empresa tiene productos configurados por lote o existencias por lote.',
    }));
  });

  it('restaura datos y muestra advertencia si no puede verificar lotes en tenant', async () => {
    saveEmpresaConfiguracionNegocioMock.mockRejectedValue(
      backendError('CAPACIDAD_LOTES_VALIDACION_TENANT_FALLIDA')
    );

    renderPage();

    const checkbox = await lotesCheckbox();
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(getEmpresaConfiguracionNegocioMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No se pudo verificar el uso de lotes en el tenant. No se realizaron cambios.',
    }));
  });

  it('restaura datos y muestra advertencia cuando Productos por peso esta en uso', async () => {
    saveEmpresaConfiguracionNegocioMock.mockRejectedValue(backendError('CAPACIDAD_PESO_EN_USO'));

    renderPage();

    const checkbox = await capabilityCheckbox('Productos por peso');
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(getEmpresaConfiguracionNegocioMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No puedes desactivar Productos por peso porque esta empresa tiene productos configurados por peso.',
    }));
  });

  it('restaura datos y muestra advertencia cuando Productos por presentación esta en uso', async () => {
    saveEmpresaConfiguracionNegocioMock.mockRejectedValue(backendError('CAPACIDAD_PRESENTACIONES_EN_USO'));

    renderPage();

    const checkbox = await capabilityCheckbox('Productos por presentación');
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(getEmpresaConfiguracionNegocioMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No se puede desactivar Productos por presentación porque esta empresa tiene presentaciones activas asociadas a sus productos.',
    }));
  });

  it('restaura datos y muestra advertencia si no puede verificar productos por peso en tenant', async () => {
    saveEmpresaConfiguracionNegocioMock.mockRejectedValue(
      backendError('CAPACIDAD_PESO_TENANT_NO_DISPONIBLE')
    );

    renderPage();

    const checkbox = await capabilityCheckbox('Productos por peso');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(getEmpresaConfiguracionNegocioMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No se pudo verificar el uso de productos por peso en el tenant. No se realizaron cambios.',
    }));
  });

  it('restaura datos y muestra advertencia si no puede verificar presentaciones en tenant', async () => {
    saveEmpresaConfiguracionNegocioMock.mockRejectedValue(
      backendError('CAPACIDAD_PRESENTACIONES_VALIDACION_TENANT_FALLIDA')
    );

    renderPage();

    const checkbox = await capabilityCheckbox('Productos por presentación');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(getEmpresaConfiguracionNegocioMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No se pudo verificar el uso de presentaciones en el tenant. No se realizaron cambios.',
    }));
  });

  it('restaura datos y muestra advertencia cuando Seriales e IMEI esta en uso', async () => {
    saveEmpresaConfiguracionNegocioMock.mockRejectedValue(backendError('CAPACIDAD_SERIALES_EN_USO'));

    renderPage();

    const checkbox = await capabilityCheckbox('Seriales e IMEI en ventas');
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(getEmpresaConfiguracionNegocioMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No se puede desactivar Seriales e IMEI en ventas porque esta empresa tiene productos que los requieren o seriales ya registrados en ventas.',
    }));
  });

  it('restaura datos y muestra advertencia si no puede verificar seriales e IMEI en tenant', async () => {
    saveEmpresaConfiguracionNegocioMock.mockRejectedValue(
      backendError('CAPACIDAD_SERIALES_VALIDACION_TENANT_FALLIDA')
    );

    renderPage();

    const checkbox = await capabilityCheckbox('Seriales e IMEI en ventas');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Guardar configuraci/ }));

    await waitFor(() => expect(getEmpresaConfiguracionNegocioMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(swalFireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No se pudo verificar el uso de seriales e IMEI en el tenant. No se realizaron cambios.',
    }));
  });
});
