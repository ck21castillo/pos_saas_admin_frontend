import { describe, expect, it } from 'vitest';
import { TIPO_NEGOCIO_LABELS, TIPO_NEGOCIO_OPTIONS, type TipoNegocio } from './adminEmpresas';

describe('adminEmpresas business types', () => {
  it('mantiene tecnologia y servicio tecnico como codigo valido', () => {
    const code: TipoNegocio = 'TECNOLOGIA_SERVICIO_TECNICO';

    expect(TIPO_NEGOCIO_LABELS[code]).toBe('Tecnología y servicio técnico');
    expect(TIPO_NEGOCIO_OPTIONS).toContainEqual(expect.objectContaining({
      value: code,
      label: 'Tecnología y servicio técnico',
    }));
  });
});
