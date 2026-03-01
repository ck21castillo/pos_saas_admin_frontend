import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import { listEmpresas, setEmpresaEstado, type Empresa } from '../../api/adminEmpresas';

export default function EmpresasPage() {
    const adminEmail = useSelector((s: RootState) => s.adminAuth.admin?.email) ?? '';
    const [q, setQ] = useState('');
    const [items, setItems] = useState<Empresa[]>([]);
    const [total, setTotal] = useState(0);
    const [limit] = useState(25);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);

    const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
    const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

    const load = async () => {
        setLoading(true);
        try {
            const r = await listEmpresas({ q, limit, offset });
            setItems(r.items);
            setTotal(r.total);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [offset]); // eslint-disable-line
    // búsqueda manual (botón) para no spamear

    const onToggleEstado = async (e: Empresa) => {
        const next = e.estado ? 0 : 1;
        const label = next ? 'ACTIVAR' : 'DESACTIVAR';

        const ok = await Swal.fire({
            title: `${label} empresa`,
            text: `${e.nombre} (ID ${e.id_empresa})`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, confirmar',
            cancelButtonText: 'Cancelar',
        });

        if (!ok.isConfirmed) return;

        await setEmpresaEstado(e.id_empresa, next as 0 | 1);
        await load();
    };

    return (
        <PageLayout
            title="Empresas"
            right={<div style={{ fontSize: 12, opacity: 0.7 }}>Sesión: {adminEmail}</div>}
        >
            <div className="d-flex gap-2 align-items-center mb-3">
                <input
                    className="form-control"
                    placeholder="Buscar por nombre…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ maxWidth: 360 }}
                />
                <button className="btn btn-primary" onClick={() => { setOffset(0); load(); }}>
                    Buscar
                </button>
                <div className="ms-auto" style={{ fontSize: 12, opacity: 0.7 }}>
                    Total: {total}
                </div>
            </div>

            <div className="table-responsive">
                <table className="table table-sm align-middle">
                    <thead>
                        <tr>
                            <th style={{ width: 90 }}>ID</th>
                            <th>Nombre</th>
                            <th style={{ width: 140 }}>Estado</th>
                            <th style={{ width: 220 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} className="py-4">Cargando…</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan={4} className="py-4">Sin resultados</td></tr>
                        ) : (
                            items.map(e => (
                                <tr key={e.id_empresa}>
                                    <td>{e.id_empresa}</td>
                                    <td style={{ fontWeight: 600 }}>{e.nombre}</td>
                                    <td>
                                        {e.estado ? (
                                            <span className="badge text-bg-success">Activa</span>
                                        ) : (
                                            <span className="badge text-bg-danger">Inactiva</span>
                                        )}
                                    </td>
                                    <td className="text-end">
                                        <a className="btn btn-outline-primary btn-sm me-2" href={`#/empresas/${e.id_empresa}`}>
                                            Configurar
                                        </a>
                                        <button
                                            className={`btn btn-sm ${e.estado ? 'btn-outline-danger' : 'btn-outline-success'}`}
                                            onClick={() => onToggleEstado(e)}
                                        >
                                            {e.estado ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="d-flex align-items-center gap-2 mt-2">
                <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setOffset(Math.max(0, offset - limit))}>
                    ← Anterior
                </button>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Página {page} / {pages}
                </div>
                <button className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => setOffset(offset + limit)}>
                    Siguiente →
                </button>
            </div>
        </PageLayout>
    );
}
