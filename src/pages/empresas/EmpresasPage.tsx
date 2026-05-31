import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import { listEmpresas, setEmpresaEstado, type Empresa } from '../../api/adminEmpresas';

const tipoNegocioLabel: Record<string, string> = {
    GENERAL: 'Otro negocio',
    DROGUERIA: 'Drogueria',
    TIENDA_MINIMARKET: 'Tienda / minimarket',
};

const valueOrDash = (value?: string | null) => {
    const text = String(value ?? '').trim();
    return text || '-';
};

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

    const onToggleEstado = async (e: Empresa) => {
        const next = e.estado ? 0 : 1;
        const label = next ? 'ACTIVAR' : 'DESACTIVAR';

        const ok = await Swal.fire({
            title: `${label} empresa`,
            text: `${e.nombre} (ID ${e.id_empresa})`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Si, confirmar',
            cancelButtonText: 'Cancelar',
        });

        if (!ok.isConfirmed) return;

        await setEmpresaEstado(e.id_empresa, next as 0 | 1);
        await load();
    };

    return (
        <PageLayout
            title="Empresas"
            right={<div style={{ fontSize: 12, opacity: 0.7 }}>Sesion: {adminEmail}</div>}
        >
            <div className="d-flex gap-2 align-items-center mb-3">
                <input
                    className="form-control"
                    placeholder="Buscar por nombre, NIT, codigo, telefono o ciudad..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ maxWidth: 460 }}
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
                            <th style={{ width: 70 }}>ID</th>
                            <th style={{ minWidth: 240 }}>Empresa</th>
                            <th style={{ minWidth: 160 }}>Tipo de negocio</th>
                            <th style={{ minWidth: 220 }}>Contacto</th>
                            <th style={{ minWidth: 240 }}>Ubicacion</th>
                            <th style={{ width: 140 }}>Estado</th>
                            <th style={{ width: 220 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} className="py-4">Cargando...</td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan={7} className="py-4">Sin resultados</td></tr>
                        ) : (
                            items.map(e => (
                                <tr key={e.id_empresa}>
                                    <td>{e.id_empresa}</td>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{e.nombre}</div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            Codigo: {valueOrDash(e.codigo)}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            NIT / Documento: {valueOrDash(e.nit)}
                                        </div>
                                    </td>
                                    <td>
                                        <span className="badge text-bg-light border">
                                            {tipoNegocioLabel[String(e.tipo_negocio ?? 'GENERAL')] ?? valueOrDash(e.tipo_negocio)}
                                        </span>
                                        <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                                            {valueOrDash(e.tipo_negocio)}
                                        </div>
                                    </td>
                                    <td>
                                        <div>Tel: {valueOrDash(e.telefono)}</div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            {valueOrDash(e.direccion)}
                                        </div>
                                    </td>
                                    <td>
                                        <div>{valueOrDash(e.departamento_nombre ?? e.codigo_departamento)}</div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            {valueOrDash(e.municipio_nombre ?? e.codigo_municipio)}
                                        </div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            Barrio: {valueOrDash(e.barrio)}
                                        </div>
                                    </td>
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
                    Anterior
                </button>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Pagina {page} / {pages}
                </div>
                <button className="btn btn-outline-secondary btn-sm" disabled={page >= pages} onClick={() => setOffset(offset + limit)}>
                    Siguiente
                </button>
            </div>
        </PageLayout>
    );
}
