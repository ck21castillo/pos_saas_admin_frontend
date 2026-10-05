import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Swal from 'sweetalert2';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SaasPlansPage from './SaasPlansPage';
import {
  getPlanCapabilities,
  getPlanPublicProfile,
  listarPlanesSaas,
  savePlanPublicProfile,
  type SaasPlan,
  type SaasPlanPublicBenefit,
} from '../../api/adminSaas';

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(() => Promise.resolve({ isConfirmed: true })),
  },
}));

vi.mock('../../api/adminSaas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/adminSaas')>();
  return {
    ...actual,
    listarPlanesSaas: vi.fn(),
    crearPlanSaas: vi.fn(),
    actualizarPlanSaas: vi.fn(),
    getPlanCapabilities: vi.fn(),
    savePlanCapabilities: vi.fn(),
    getPlanPublicProfile: vi.fn(),
    savePlanPublicProfile: vi.fn(),
  };
});

const listarPlanesSaasMock = vi.mocked(listarPlanesSaas);
const getPlanCapabilitiesMock = vi.mocked(getPlanCapabilities);
const getPlanPublicProfileMock = vi.mocked(getPlanPublicProfile);
const savePlanPublicProfileMock = vi.mocked(savePlanPublicProfile);
const swalFireMock = vi.mocked(Swal.fire);

const plan: SaasPlan = {
  id_plan: 10,
  codigo: 'PRO',
  nombre: 'Bersano POS Pro',
  descripcion: 'Plan con funciones avanzadas.',
  precio_mensual: 100000,
  precio_anual: 1100000,
  usuarios_incluidos: 5,
  precio_usuario_extra_mensual: 0,
  precio_usuario_extra_anual: 0,
  whatsapp_incluido: true,
  visible_publico: true,
  precio_whatsapp_mensual: 0,
  precio_whatsapp_anual: 0,
  activo: true,
  orden: 20,
  landing_titulo: 'Bersano POS Pro',
  landing_resumen: 'Plan con funciones avanzadas.',
  landing_icono: 'storefront',
  landing_destacado: true,
  landing_etiqueta: 'PRO',
  landing_cta_texto: 'Solicitar mensual',
};

const beneficios: SaasPlanPublicBenefit[] = [
  {
    id_beneficio: 1,
    codigo_capacidad: null,
    titulo: 'Ventas POS rapidas',
    descripcion: 'Registra ventas de mostrador con productos, medios de pago y comprobantes.',
    icono: 'check_circle',
    incluido: true,
    orden: 10,
  },
  {
    id_beneficio: 2,
    codigo_capacidad: 'PRECONTABILIDAD',
    titulo: 'Precontabilidad',
    descripcion: 'Prepara informacion para el contador sin convertir el POS en software contable.',
    icono: 'account_tree',
    incluido: true,
    orden: 20,
  },
  {
    id_beneficio: 3,
    codigo_capacidad: null,
    titulo: 'Comprobantes por WhatsApp',
    descripcion: 'Permite enviar comprobantes por WhatsApp cuando el plan lo incluye.',
    icono: 'chat',
    incluido: false,
    orden: 30,
  },
];

function mockHappyPath(profileBenefits = beneficios) {
  listarPlanesSaasMock.mockResolvedValue({ ok: true, items: [plan] });
  getPlanCapabilitiesMock.mockResolvedValue({ ok: true, items: [] });
  getPlanPublicProfileMock.mockResolvedValue({
    ok: true,
    plan,
    beneficios: profileBenefits,
  });
  savePlanPublicProfileMock.mockResolvedValue({
    ok: true,
    plan,
    beneficios: profileBenefits,
  });
}

async function openPublicEditor() {
  render(<SaasPlansPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
  fireEvent.click(await screen.findByRole('tab', { name: 'Presentacion publica' }));
  await screen.findByText('Matriz editorial de funciones');
}

describe('SaasPlansPage public profile editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHappyPath();
  });

  it('carga la matriz completa de beneficios', async () => {
    await openPublicEditor();

    expect(screen.getByDisplayValue('Ventas POS rapidas')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Precontabilidad').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Comprobantes por WhatsApp')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Prepara informacion para el contador sin convertir el POS en software contable.')).toBeInTheDocument();
  });

  it('edita la explicacion de una funcion y la refleja en la previsualizacion', async () => {
    await openPublicEditor();

    const explanation = screen.getByLabelText('Explicacion de Ventas POS rapidas');
    fireEvent.change(explanation, { target: { value: 'Nueva ayuda visible en el signo de pregunta.' } });

    expect(screen.getByLabelText('Ventas POS rapidas: Nueva ayuda visible en el signo de pregunta.')).toBeInTheDocument();
  });

  it('cambia incluido/no incluido sin eliminar la funcion', async () => {
    await openPublicEditor();

    const row = screen.getByDisplayValue('Comprobantes por WhatsApp').closest('tr');
    expect(row).not.toBeNull();
    const checkbox = within(row as HTMLElement).getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(screen.getByDisplayValue('Comprobantes por WhatsApp')).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it('reordena beneficios y guarda el orden local', async () => {
    await openPublicEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Bajar Ventas POS rapidas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha publica' }));

    await waitFor(() => expect(savePlanPublicProfileMock).toHaveBeenCalled());
    const payload = savePlanPublicProfileMock.mock.calls[0]?.[1];
    expect(payload?.beneficios[0]?.titulo).toBe('Precontabilidad');
    expect(payload?.beneficios[1]?.titulo).toBe('Ventas POS rapidas');
  });

  it('guarda la ficha publica con los cambios editoriales', async () => {
    await openPublicEditor();

    fireEvent.change(screen.getByLabelText('Titulo publico'), { target: { value: 'Plan Pro actualizado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha publica' }));

    await waitFor(() => expect(savePlanPublicProfileMock).toHaveBeenCalledWith(10, expect.objectContaining({
      landing_titulo: 'Plan Pro actualizado',
      landing_icono: 'storefront',
      landing_cta_texto: 'Solicitar mensual',
    })));
  });

  it('mantiene cambios locales si falla el guardado', async () => {
    savePlanPublicProfileMock.mockRejectedValueOnce(new Error('fallo api'));
    await openPublicEditor();

    fireEvent.change(screen.getByLabelText('Explicacion de Precontabilidad'), { target: { value: 'Texto local sin guardar.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha publica' }));

    await waitFor(() => expect(swalFireMock).toHaveBeenCalledWith('Error', 'No se pudo guardar la ficha publica.', 'error'));
    expect(screen.getByDisplayValue('Texto local sin guardar.')).toBeInTheDocument();
  });

  it('no permite guardar ficha publica de un plan sin crear', async () => {
    render(<SaasPlansPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nuevo plan' }));

    expect(screen.getByRole('tab', { name: 'Presentacion publica' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar ficha publica' })).not.toBeInTheDocument();
  });
});
