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
    const [limit, setLimit] = useState(25);
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(false);

    const page = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
    const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + items.length, total);

    const load = async (nextOffset = offset, nextLimit = limit, nextQ = q) => {
        setLoading(true);
        try {
            const r = await listEmpresas({ q: nextQ.trim() || undefined, limit: nextLimit, offset: nextOffset });
            setItems(r.items ?? []);
            setTotal(Number(r.total ?? 0));
            setLimit(Number(r.limit ?? nextLimit));
            setOffset(Number(r.offset ?? nextOffset));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(0, limit); }, []); // eslint-disable-line

    const onBuscar = async () => {
        await load(0, limit, q);
    };

    const onLimitChange = async (value: number) => {
        await load(0, value, q);
    };

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
        await load(offset, limit, q);
    };

    return (
        <PageLayout
            title="Empresas"
            right={<div style={{ fontSize: 12, opacity: 0.7 }}>Sesion: {adminEmail}</div>}
        >
            <form
                className="d-flex gap-2 align-items-end mb-3 flex-wrap"
                onSubmit={(e) => {
                    e.preventDefault();
                    onBuscar();
                }}
            >
                <div style={{ minWidth: 280, maxWidth: 520, flex: '1 1 420px' }}>
                    <label className="form-label small mb-1">Buscar</label>
                    <input
                        className="form-control"
                        placeholder="Nombre, NIT, codigo, telefono o ciudad"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
                <div style={{ width: 120 }}>
                    <label className="form-label small mb-1">Mostrar</label>
                    <select
                        className="form-select"
                        value={limit}
                        onChange={(e) => onLimitChange(Number(e.target.value))}
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading}>
                    Buscar
                </button>
                <button
                    className="btn btn-outline-secondary"
                    type="button"
                    disabled={loading || (!q && offset === 0)}
                    onClick={() => {
                        setQ('');
                        load(0, limit, '');
                    }}
                >
                    Limpiar
                </button>
                <div className="ms-auto" style={{ fontSize: 12, opacity: 0.7 }}>
                    Total: {total}
                </div>
            </form>

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

            <div className="d-flex align-items-center justify-content-between gap-2 mt-2 flex-wrap">
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Mostrando {from}-{to} de {total}
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button
                        className="btn btn-outline-secondary btn-sm"
                        disabled={page <= 1 || loading}
                        onClick={() => load(Math.max(0, offset - limit), limit, q)}
                    >
                        Anterior
                    </button>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Pagina {page} de {pages}
                    </div>
                    <button
                        className="btn btn-outline-secondary btn-sm"
                        disabled={page >= pages || loading}
                        onClick={() => load(offset + limit, limit, q)}
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </PageLayout>
    );
}