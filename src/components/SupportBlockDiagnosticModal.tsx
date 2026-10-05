import type { SaasCapabilityBlockDiagnostic } from '../api/adminSaas';

type Props = {
  diagnostic: SaasCapabilityBlockDiagnostic | null;
  onClose: () => void;
};

function dateOnly(value?: string | null): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function message(diagnostic: SaasCapabilityBlockDiagnostic): string {
  return String(diagnostic.mensaje ?? diagnostic.message ?? 'No se puede desactivar soporte tecnico con ordenes abiertas.');
}

function openCount(diagnostic: SaasCapabilityBlockDiagnostic): number | null {
  const value = diagnostic.ordenes_abiertas
    ?? diagnostic.cantidad_ordenes_abiertas
    ?? diagnostic.total_ordenes_abiertas;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function stateGroups(diagnostic: SaasCapabilityBlockDiagnostic): Array<{ estado: string; cantidad: number }> {
  const source = diagnostic.por_estado ?? diagnostic.estados;
  if (Array.isArray(source)) {
    return source.map((item) => ({
      estado: String(item.estado ?? 'Sin estado'),
      cantidad: Number(item.cantidad ?? item.total ?? 0),
    }));
  }
  if (typeof source === 'object' && source !== null) {
    return Object.entries(source).map(([estado, cantidad]) => ({
      estado,
      cantidad: Number(cantidad ?? 0),
    }));
  }
  return [];
}

function sampleOrders(diagnostic: SaasCapabilityBlockDiagnostic) {
  return diagnostic.muestra_ordenes ?? diagnostic.muestra ?? [];
}

export default function SupportBlockDiagnosticModal({ diagnostic, onClose }: Props) {
  if (!diagnostic) return null;
  const groups = stateGroups(diagnostic);
  const orders = sampleOrders(diagnostic);

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title mb-0">Soporte tecnico no se puede desactivar</h5>
                <div className="text-muted small">Cierra o corrige las ordenes abiertas antes de desactivar esta capacidad.</div>
              </div>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
            </div>
            <div className="modal-body">
              <div className="alert alert-warning py-2">{message(diagnostic)}</div>

              <div className="row g-2 mb-3">
                <div className="col-12 col-md-4">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small">Ordenes abiertas</div>
                    <div className="fw-bold fs-4">{openCount(diagnostic) ?? '-'}</div>
                  </div>
                </div>
                <div className="col-12 col-md-8">
                  <div className="border rounded p-3 h-100">
                    <div className="text-muted small mb-2">Agrupacion por estado</div>
                    {groups.length === 0 ? (
                      <div className="text-muted small">Sin agrupacion recibida.</div>
                    ) : (
                      <div className="d-flex flex-wrap gap-2">
                        {groups.map((item) => (
                          <span className="badge text-bg-light border text-dark" key={item.estado}>
                            {item.estado}: {item.cantidad}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="fw-semibold mb-2">Muestra de ordenes</div>
              {orders.length === 0 ? (
                <div className="text-muted small">El backend no envio muestra de ordenes.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Orden</th>
                        <th>Estado</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 8).map((orden, index) => (
                        <tr key={`${orden.id_orden ?? orden.id ?? orden.numero ?? index}`}>
                          <td>{orden.numero ?? orden.codigo ?? orden.id_orden ?? orden.id ?? '-'}</td>
                          <td>{orden.estado ?? '-'}</td>
                          <td>{orden.cliente ?? orden.descripcion ?? '-'}</td>
                          <td>{dateOnly(orden.fecha ?? orden.created_at ?? null) || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
