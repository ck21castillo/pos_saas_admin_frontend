import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Swal from 'sweetalert2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actualizarCategoriaNegocio,
  crearCategoriaNegocio,
  listarCategoriasNegocio,
  type CategoriaNegocio,
} from '../../api/adminCategoriasNegocio';
import BusinessCategoriesPage from './BusinessCategoriesPage';

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
  },
}));

vi.mock('../../api/adminCategoriasNegocio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/adminCategoriasNegocio')>();
  return {
    ...actual,
    listarCategoriasNegocio: vi.fn(),
    crearCategoriaNegocio: vi.fn(),
    actualizarCategoriaNegocio: vi.fn(),
  };
});

const listarCategoriasNegocioMock = vi.mocked(listarCategoriasNegocio);
const crearCategoriaNegocioMock = vi.mocked(crearCategoriaNegocio);
const actualizarCategoriaNegocioMock = vi.mocked(actualizarCategoriaNegocio);
const swalFireMock = vi.mocked(Swal.fire);

const techCategory: CategoriaNegocio = {
  id_categoria_negocio: 7,
  codigo: 'TECNOLOGIA_SERVICIO_TECNICO',
  nombre: 'Tecnologia y servicio tecnico',
  descripcion: 'Venta y reparacion de equipos.',
  perfil_operativo: 'TECNOLOGIA_SERVICIO_TECNICO',
  activo: true,
  visible_publico: true,
  orden: 20,
  capacidades_iniciales: [
    { codigo_capacidad: 'SOPORTE_TECNICO', habilitada_por_defecto: true },
    { codigo_capacidad: 'FACTURACION_ELECTRONICA', habilitada_por_defecto: true },
  ],
};

const generalCategory: CategoriaNegocio = {
  id_categoria_negocio: 3,
  codigo: 'GENERAL',
  nombre: 'Otro negocio',
  descripcion: null,
  perfil_operativo: 'GENERAL',
  activo: true,
  visible_publico: false,
  orden: 10,
  capacidades_iniciales: [],
};

describe('BusinessCategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listarCategoriasNegocioMock.mockResolvedValue({
      ok: true,
      items: [techCategory, generalCategory],
      perfiles_operativos: [
        { codigo: 'GENERAL', nombre: 'General' },
        { codigo: 'TECNOLOGIA_SERVICIO_TECNICO', nombre: 'Tecnologia y servicio tecnico' },
      ],
      capacidades: [
        { codigo_capacidad: 'SOPORTE_TECNICO', nombre: 'Soporte tecnico', activo: true },
        { codigo_capacidad: 'SERIALES_EN_VENTA', nombre: 'Seriales en venta', activo: true },
        { codigo_capacidad: 'PRECONTABILIDAD', nombre: 'Precontabilidad', activo: true },
      ],
    });
    crearCategoriaNegocioMock.mockResolvedValue({
      ok: true,
      item: { ...techCategory, id_categoria_negocio: 12, codigo: 'FERRETERIA', nombre: 'Ferreteria' },
    });
    actualizarCategoriaNegocioMock.mockResolvedValue({
      ok: true,
      item: { ...techCategory, nombre: 'Tecnologia actualizada' },
    });
  });

  it('muestra el listado ordenado por orden', async () => {
    render(<BusinessCategoriesPage />);

    await screen.findByText('Otro negocio');
    const rows = await screen.findAllByRole('row');
    expect(within(rows[1]).getByText('Otro negocio')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Tecnologia y servicio tecnico')).toBeInTheDocument();
  });

  it('envia solamente la capacidad marcada en formato de lista compatible con backend', async () => {
    render(<BusinessCategoriesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva categoria' }));
    fireEvent.change(screen.getByLabelText('Codigo'), { target: { value: 'FERRETERIA' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ferreteria' } });
    fireEvent.change(screen.getByLabelText('Orden'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Perfil operativo'), { target: { value: 'GENERAL' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Seriales en venta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoria' }));

    await waitFor(() => expect(crearCategoriaNegocioMock).toHaveBeenCalledWith(expect.objectContaining({
      codigo: 'FERRETERIA',
      nombre: 'Ferreteria',
      orden: 30,
      perfil_operativo: 'GENERAL',
      capacidades_iniciales: [
        { codigo_capacidad: 'SERIALES_EN_VENTA', habilitada_por_defecto: true },
      ],
    })));
  });

  it('no envia capacidades desmarcadas', async () => {
    render(<BusinessCategoriesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva categoria' }));
    fireEvent.change(screen.getByLabelText('Codigo'), { target: { value: 'GENERAL_NUEVA' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'General nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoria' }));

    await waitFor(() => expect(crearCategoriaNegocioMock).toHaveBeenCalled());
    const payload = crearCategoriaNegocioMock.mock.calls[0]?.[0];
    expect(payload?.capacidades_iniciales).toEqual([]);
  });

  it('mantiene el payload de capacidades como arreglo de asociaciones activas', async () => {
    render(<BusinessCategoriesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nueva categoria' }));
    fireEvent.change(screen.getByLabelText('Codigo'), { target: { value: 'SOPORTE' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Soporte' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /Soporte tecnico/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoria' }));

    await waitFor(() => expect(crearCategoriaNegocioMock).toHaveBeenCalled());
    const payload = crearCategoriaNegocioMock.mock.calls[0]?.[0];
    expect(Array.isArray(payload?.capacidades_iniciales)).toBe(true);
    expect(payload?.capacidades_iniciales).toEqual([
      { codigo_capacidad: 'SOPORTE_TECNICO', habilitada_por_defecto: true },
    ]);
  });

  it('no renderiza ni envia capacidades guardadas fuera del catalogo editable', async () => {
    render(<BusinessCategoriesPage />);

    const editButtons = await screen.findAllByRole('button', { name: 'Editar' });
    fireEvent.click(editButtons[1]);

    expect(screen.queryByText('FACTURACION_ELECTRONICA')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoria' }));

    await waitFor(() => expect(actualizarCategoriaNegocioMock).toHaveBeenCalled());
    const payload = actualizarCategoriaNegocioMock.mock.calls[0]?.[1];
    expect(payload?.capacidades_iniciales).toEqual([
      { codigo_capacidad: 'SOPORTE_TECNICO', habilitada_por_defecto: true },
    ]);
  });

  it('edita una categoria sin enviar el codigo inmutable', async () => {
    render(<BusinessCategoriesPage />);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);
    expect(screen.getByLabelText('Codigo')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tecnologia actualizada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoria' }));

    await waitFor(() => expect(actualizarCategoriaNegocioMock).toHaveBeenCalledWith(3, expect.not.objectContaining({
      codigo: expect.anything(),
    })));
  });

  it('muestra errores del backend sin perder los datos del formulario', async () => {
    actualizarCategoriaNegocioMock.mockRejectedValueOnce({
      response: { data: { error: 'CODIGO_DUPLICADO' } },
    });

    render(<BusinessCategoriesPage />);

    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0]);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nombre local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar categoria' }));

    await waitFor(() => expect(swalFireMock).toHaveBeenCalledWith('Error', 'CODIGO_DUPLICADO', 'error'));
    expect(screen.getByDisplayValue('Nombre local')).toBeInTheDocument();
  });
});
