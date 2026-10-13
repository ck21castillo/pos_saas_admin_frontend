import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  actualizarCategoriaNegocio,
  categoriaNegocioId,
  crearCategoriaNegocio,
  listarCategoriasNegocio,
  type CapacidadInicial,
  type CapacidadNegocioCatalogItem,
  type CategoriaNegocio,
  type CategoriaNegocioPayload,
  type PerfilOperativoCatalogItem,
} from '../../api/adminCategoriasNegocio';
import PageLayout from '../../layout/PageLayout';

type CategoryForm = {
  codigo: string;
  nombre: string;
  descripcion: string;
  perfil_operativo: string;
  activo: boolean;
  visible_publico: boolean;
  orden: number;
  capacidades_iniciales: Record<string, boolean>;
};

const emptyForm: CategoryForm = {
  codigo: '',
  nombre: '',
  descripcion: '',
  perfil_operativo: '',
  activo: true,
  visible_publico: true,
  orden: 100,
  capacidades_iniciales: {},
};

function boolValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    return ['1', 't', 'true', 'yes', 'si', 'on'].includes(text);
  }
  return false;
}

function emptyToNull(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

function normalizeProfileOptions(items?: PerfilOperativoCatalogItem[] | null): PerfilOperativoCatalogItem[] {
  const map = new Map<string, PerfilOperativoCatalogItem>();
  for (const item of items ?? []) {
    const code = String(item.codigo ?? '').trim();
    if (!code) continue;
    map.set(code, {
      codigo: code,
      nombre: item.nombre || code,
      descripcion: item.descripcion ?? null,
    });
  }
  return [...map.values()];
}

function normalizeCapabilityOptions(items?: CapacidadNegocioCatalogItem[] | null): CapacidadNegocioCatalogItem[] {
  const map = new Map<string, CapacidadNegocioCatalogItem>();
  for (const item of items ?? []) {
    const code = String(item.codigo_capacidad ?? '').trim();
    if (!code) continue;
    if (item.activo !== undefined && item.activo !== null && !boolValue(item.activo)) continue;
    map.set(code, {
      codigo_capacidad: code,
      nombre: item.nombre || code,
      descripcion: item.descripcion ?? null,
      activo: item.activo ?? true,
    });
  }
  return [...map.values()].sort((a, b) =>
    String(a.nombre || a.codigo_capacidad).localeCompare(String(b.nombre || b.codigo_capacidad))
  );
}

function capabilityMap(value: CategoriaNegocio['capacidades_iniciales']): Record<string, boolean> {
  if (!value) return {};
  if (Array.isArray(value)) {
    return Object.fromEntries(value
      .map((item) => {
        if (typeof item !== 'object' || item === null) return null;
        const data = item as Partial<CapacidadInicial>;
        const code = String(data.codigo_capacidad ?? '').trim();
        return code ? [code, boolValue(data.habilitada_por_defecto)] : null;
      })
      .filter((entry): entry is [string, boolean] => Boolean(entry)));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([code, enabled]) => [code, boolValue(enabled)]));
  }
  return {};
}

function capabilityPayload(values: Record<string, boolean>, options: CapacidadNegocioCatalogItem[]): CapacidadInicial[] {
  const allowed = new Set(options.map((option) => option.codigo_capacidad));
  return Object.entries(values)
    .filter(([code, enabled]) => code.trim() && enabled && allowed.has(code))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code]) => ({
      codigo_capacidad: code,
      habilitada_por_defecto: true,
    }));
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;
  const response = error.response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return fallback;
  const data = response.data;
  if (typeof data !== 'object' || data === null) return fallback;
  const message = 'message' in data ? data.message : 'error' in data ? data.error : null;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function toForm(item: CategoriaNegocio): CategoryForm {
  return {
    codigo: item.codigo || '',
    nombre: item.nombre || '',
    descripcion: item.descripcion || '',
    perfil_operativo: item.perfil_operativo || '',
    activo: boolValue(item.activo),
    visible_publico: boolValue(item.visible_publico),
    orden: Number(item.orden || 0),
    capacidades_iniciales: capabilityMap(item.capacidades_iniciales),
  };
}

function buildPayload(form: CategoryForm, capabilityOptions: CapacidadNegocioCatalogItem[]): CategoriaNegocioPayload {
  return {
    codigo: form.codigo.trim(),
    nombre: form.nombre.trim(),
    descripcion: emptyToNull(form.descripcion),
    perfil_operativo: emptyToNull(form.perfil_operativo),
    activo: form.activo,
    visible_publico: form.visible_publico,
    orden: Number(form.orden || 0),
    capacidades_iniciales: capabilityPayload(form.capacidades_iniciales, capabilityOptions),
  };
}

function sortCategories(items: CategoriaNegocio[]): CategoriaNegocio[] {
  return [...items].sort((a, b) => {
    const byOrder = Number(a.orden || 0) - Number(b.orden || 0);
    if (byOrder) return byOrder;
    return String(a.codigo || a.nombre || '').localeCompare(String(b.codigo || b.nombre || ''));
  });
}

export default function BusinessCategoriesPage() {
  const [items, setItems] = useState<CategoriaNegocio[]>([]);
  const [selected, setSelected] = useState<CategoriaNegocio | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileOptions, setProfileOptions] = useState<PerfilOperativoCatalogItem[]>([]);
  const [capabilityOptions, setCapabilityOptions] = useState<CapacidadNegocioCatalogItem[]>([]);

  const orderedItems = useMemo(() => sortCategories(items), [items]);
  const effectiveProfileOptions = useMemo(() => {
    const map = new Map(profileOptions.map((option) => [option.codigo, option]));
    const code = form.perfil_operativo.trim();
    if (code && !map.has(code)) {
      map.set(code, { codigo: code, nombre: code });
    }
    return [...map.values()];
  }, [form.perfil_operativo, profileOptions]);
  const effectiveCapabilityOptions = capabilityOptions;
  const selectedId = selected ? categoriaNegocioId(selected) : null;
  const isCreating = !selected;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listarCategoriasNegocio();
      setItems(sortCategories(response.items || []));
      const profiles = normalizeProfileOptions(
        response.catalogos?.perfiles_operativos ?? response.perfiles_operativos
      );
      const capabilities = normalizeCapabilityOptions(
        response.catalogos?.capacidades ?? response.capacidades ?? response.capacidades_disponibles
      );
      setProfileOptions(profiles);
      setCapabilityOptions(capabilities);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'No se pudieron cargar las categorias de negocio.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected || form.perfil_operativo || profileOptions.length === 0) return;
    setForm((prev) => ({ ...prev, perfil_operativo: profileOptions[0].codigo }));
  }, [form.perfil_operativo, profileOptions, selected]);

  const startCreate = () => {
    setSelected(null);
    setForm({
      ...emptyForm,
      perfil_operativo: profileOptions[0]?.codigo ?? '',
    });
    setShowEditor(true);
  };

  const startEdit = (item: CategoriaNegocio) => {
    setSelected(item);
    setForm(toForm(item));
    setShowEditor(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setShowEditor(false);
  };

  const save = async () => {
    const payload: CategoriaNegocioPayload = buildPayload(form, capabilityOptions);

    setSaving(true);
    try {
      if (isCreating) {
        const response = await crearCategoriaNegocio(payload);
        setSelected(response.item);
        setForm(toForm(response.item));
        await load();
        setShowEditor(false);
        await Swal.fire('Guardado', 'Categoria de negocio creada.', 'success');
        return;
      }

      if (!selectedId) {
        await Swal.fire('Error', 'No se encontro el identificador de la categoria.', 'error');
        return;
      }

      const updatePayload = {
        nombre: payload.nombre,
        descripcion: payload.descripcion,
        perfil_operativo: payload.perfil_operativo,
        activo: payload.activo,
        visible_publico: payload.visible_publico,
        orden: payload.orden,
        capacidades_iniciales: payload.capacidades_iniciales,
      };
      const response = await actualizarCategoriaNegocio(selectedId, updatePayload);
      setSelected(response.item);
      setForm(toForm(response.item));
      await load();
      setShowEditor(false);
      await Swal.fire('Guardado', 'Categoria de negocio actualizada.', 'success');
    } catch (err: unknown) {
      await Swal.fire('Error', apiErrorMessage(err, 'No se pudo guardar la categoria de negocio.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Categorias de negocio">
      <div className="card shadow-sm mb-3">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h5 className="mb-1">Catalogo de categorias de negocio</h5>
            <div className="text-muted">
              Administra la presentacion operativa del catalogo sin configurar planes desde esta pantalla.
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={startCreate}>
            Nueva categoria
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2">
          <span>{error}</span>
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={load} disabled={loading}>
            Reintentar
          </button>
        </div>
      )}

      <div className="row g-3">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header bg-white d-flex align-items-start justify-content-between gap-2">
                <div>
                  <strong>Categorias disponibles</strong>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Ordenado por prioridad y codigo.
                  </div>
                </div>
                <button className="btn btn-outline-secondary btn-sm" onClick={load} disabled={loading}>
                  {loading ? 'Cargando...' : 'Actualizar'}
                </button>
              </div>

              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Orden</th>
                      <th>Categoria</th>
                      <th>Perfil</th>
                      <th style={{ width: 120 }}>Estado</th>
                      <th style={{ width: 120 }}>Publica</th>
                      <th style={{ width: 110 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-muted py-3">
                          {loading ? 'Cargando categorias...' : 'No hay categorias de negocio registradas.'}
                        </td>
                      </tr>
                    ) : (
                      orderedItems.map((item) => {
                        const id = categoriaNegocioId(item);
                        const active = boolValue(item.activo);
                        const publicVisible = boolValue(item.visible_publico);
                        return (
                          <tr key={id ?? item.codigo}>
                            <td>{item.orden}</td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{item.nombre}</div>
                              <code>{item.codigo}</code>
                              {item.descripcion && (
                                <div className="text-muted" style={{ fontSize: 12 }}>
                                  {item.descripcion}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: 12 }}>{item.perfil_operativo || '-'}</td>
                            <td>
                              <span className={`badge ${active ? 'bg-success' : 'bg-secondary'}`}>
                                {active ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${publicVisible ? 'text-bg-info' : 'text-bg-light border'}`}>
                                {publicVisible ? 'Visible' : 'Oculta'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm"
                                onClick={() => startEdit(item)}
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
      </div>

      {showEditor && (
        <>
          <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title mb-0">
                      {isCreating ? 'Nueva categoria' : 'Editar categoria'}
                    </h5>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {isCreating ? 'Crea una categoria de negocio.' : `Codigo: ${form.codigo}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Cerrar"
                    onClick={closeEditor}
                    disabled={saving}
                  />
                </div>
                <div className="modal-body">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Codigo</label>
                  <input
                    className="form-control"
                    aria-label="Codigo"
                    value={form.codigo}
                    disabled={!isCreating}
                    onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                  />
                  {!isCreating && (
                    <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                      El codigo es inmutable.
                    </div>
                  )}
                </div>

                <div className="col-12 col-md-6">
                  <label className="form-label">Orden</label>
                  <input
                    type="number"
                    className="form-control"
                    aria-label="Orden"
                    value={form.orden}
                    onChange={(e) => setForm((prev) => ({ ...prev, orden: Number(e.target.value || 0) }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Nombre</label>
                  <input
                    className="form-control"
                    aria-label="Nombre"
                    value={form.nombre}
                    onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Descripcion</label>
                  <textarea
                    className="form-control"
                    aria-label="Descripcion"
                    rows={3}
                    value={form.descripcion}
                    onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">Perfil operativo</label>
                  <select
                    className="form-select"
                    aria-label="Perfil operativo"
                    value={form.perfil_operativo}
                    onChange={(e) => setForm((prev) => ({ ...prev, perfil_operativo: e.target.value }))}
                    disabled={effectiveProfileOptions.length === 0}
                  >
                    {effectiveProfileOptions.length === 0 ? (
                      <option value="">Sin perfiles disponibles</option>
                    ) : (
                      effectiveProfileOptions.map((option) => (
                        <option key={option.codigo} value={option.codigo}>
                          {option.nombre || option.codigo}
                        </option>
                      ))
                    )}
                  </select>
                  {effectiveProfileOptions.find((option) => option.codigo === form.perfil_operativo)?.descripcion && (
                    <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                      {effectiveProfileOptions.find((option) => option.codigo === form.perfil_operativo)?.descripcion}
                    </div>
                  )}
                </div>

                <div className="col-12">
                  <label className="form-label">Sugerencias iniciales de capacidades</label>
                  <div className="text-muted mb-2" style={{ fontSize: 12 }}>
                    Estas marcas solo sugieren capacidades para nuevas empresas de esta categoria. No activan funciones ni modifican empresas existentes.
                  </div>
                  {effectiveCapabilityOptions.length === 0 ? (
                    <div className="alert alert-info py-2 mb-0" style={{ fontSize: 13 }}>
                      No hay capacidades disponibles para sugerir.
                    </div>
                  ) : (
                    <div className="d-grid gap-2">
                      {effectiveCapabilityOptions.map((capability) => {
                        const code = capability.codigo_capacidad;
                        return (
                          <label key={code} className="border rounded p-2 d-flex align-items-start gap-2">
                            <input
                              className="form-check-input mt-1"
                              type="checkbox"
                              checked={!!form.capacidades_iniciales[code]}
                              onChange={(e) => {
                                const enabled = e.target.checked;
                                setForm((prev) => ({
                                  ...prev,
                                  capacidades_iniciales: {
                                    ...prev.capacidades_iniciales,
                                    [code]: enabled,
                                  },
                                }));
                              }}
                            />
                            <span>
                              <span className="d-block fw-semibold">{capability.nombre || code}</span>
                              <code>{code}</code>
                              {capability.descripcion && (
                                <span className="d-block text-muted" style={{ fontSize: 12 }}>
                                  {capability.descripcion}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="col-12 d-flex gap-4 flex-wrap">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      id="categoria-activa"
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm((prev) => ({ ...prev, activo: e.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="categoria-activa">Activa</label>
                  </div>
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      id="categoria-visible-publico"
                      type="checkbox"
                      checked={form.visible_publico}
                      onChange={(e) => setForm((prev) => ({ ...prev, visible_publico: e.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="categoria-visible-publico">Visible al publico</label>
                  </div>
                </div>

              </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeEditor} disabled={saving}>
                    Cerrar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar categoria'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </PageLayout>
  );
}
