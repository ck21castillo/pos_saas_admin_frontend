import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import {
    getEmpresaModulos,
    saveEmpresaModulos,
    getEmpresaPermisos,
    saveEmpresaPermisos,
    getEmpresaUsuarios,
    type EmpresaModuloItem,
    type EmpresaPermisoItem,
    type EmpresaUsuarioItem,
} from '../../api/adminEmpresas';

type ModRow = EmpresaModuloItem;
type PermRow = EmpresaPermisoItem;
type UserRow = EmpresaUsuarioItem;

/** ===========================
 *  1) Especificación de módulos/permisos "USADOS" (los del POS)
 *  ===========================
 *  Esto es lo que define qué permisos se muestran en el panel admin.
 *  Si un permiso NO está aquí, por defecto NO lo mostramos (para mantener limpio).
 */
type ModSpec = {
    key: string;
    label: string;
    icon?: string;
    perms: string[];
};

const MODULE_SPECS: ModSpec[] = [
    {
        key: 'pos',
        label: 'POS',
        icon: 'home',
        perms: ['VENTA__CREAR', 'VENTA__VER', 'VENTA__CANCELAR', 'WHATSAPP__POS_ENVIAR_COMPROBANTE'],
    },
    {
        key: 'clientes',
        label: 'Clientes',
        icon: 'groups',
        perms: ['CLIENTES__VER', 'CLIENTES__EDITAR'],
    },
    {
        key: 'deudores',
        label: 'Deudores',
        icon: 'account_balance_wallet',
        perms: ['DEUDORES__VER', 'DEUDORES__ABONAR', 'DEUDORES__DETALLE_VER', 'DEUDORES__PAGAR'],
    },
    {
        key: 'productos',
        label: 'Productos',
        icon: 'inventory_2',
        perms: ['PRODUCTOS__VER', 'PRODUCTOS__EDITAR'],
    },
    {
        key: 'categorias',
        label: 'Categorías',
        icon: 'category',
        perms: ['CATEGORIAS__VER', 'CATEGORIAS__EDITAR'],
    },
    {
        key: 'proveedores',
        label: 'Proveedores',
        icon: 'local_shipping',
        perms: ['PROVEEDORES__VER', 'PROVEEDORES__EDITAR'],
    },
    {
        key: 'inventario',
        label: 'Inventario',
        icon: 'layers',
        perms: ['INVENTARIO__VER', 'INVENTARIO__LOTE_VER', 'INVENTARIO__MOV_VER', 'INVENTARIO__AJUSTAR', 'INVENTARIO__EDITAR', 'PRODUCTOS__EDITAR'],
    },
    {
        key: 'ventas',
        label: 'Ventas',
        icon: 'shopping_cart',
        perms: ['VENTA__VER', 'VENTA__CANCELAR', 'DEVOLUCIONES__CREAR', 'DEVOLUCIONES__VER'],
    },
    {
        key: 'caja',
        label: 'Caja',
        icon: 'point_of_sale',
        perms: ['CAJA__VER', 'CAJA__ABRIR', 'CAJA__MOVIMIENTO', 'CAJA__CERRAR'],
    },
    {
        key: 'cierres',
        label: 'Cierres',
        icon: 'receipt_long',
        perms: ['CIERRE__VER', 'CIERRE__EXPORTAR', 'CIERRE__DETALLE_VER'],
    },
    {
        key: 'cortes',
        label: 'Cortes',
        icon: 'content_cut',
        perms: ['CORTES__VER', 'CORTES__CREAR', 'CORTES__DETALLE_VER'],
    },
    {
        key: 'compras',
        label: 'Compras',
        icon: 'shopping_bag',
        perms: ['COMPRAS__VER', 'COMPRAS__CREAR', 'COMPRAS__EDITAR', 'COMPRAS__CONFIRMAR', 'COMPRAS__ANULAR'],
    },
    {
        key: 'bancos',
        label: 'Bancos',
        icon: 'account_balance',
        perms: ['BANCOS__VER', 'BANCOS__MOVIMIENTO']
    },
    {
        key: 'soporte',
        label: 'Soporte',
        icon: 'support_agent',
        perms: ['SOPORTE__VER', 'SOPORTE__CREAR', 'SOPORTE__EDITAR', 'SOPORTE__ENTREGAR', 'SOPORTE__EXPORTAR', 'SOPORTE__ENVIAR', 'WHATSAPP__SOPORTE_ENVIAR_COMPROBANTE'],
    },
];

/** Permisos legacy/no usados que NO queremos mostrar en el panel admin (por limpieza) */
const UI_HIDDEN_PERMS = new Set<string>([
    // legacy singular
    'CLIENTE__VER', 'CLIENTE__EDITAR',
    'PRODUCTO__VER', 'PRODUCTO__EDITAR',
    'PROVEEDOR__VER', 'PROVEEDOR__EDITAR',
    'DEUDA__VER', 'DEUDA__ABONAR',

    // no cableados aún
    'POS__OPERAR', 'POS__COMPROBANTE_EMAIL', 'POS__FACTURA_ELECTRONICA',
    'REPORTES__VER', 'REPORTE__VER',
    'VENTA__DETALLE',
    'INVENTARIO__MOV_EXPORTAR', 'INVENTARIO__LOTE_EDITAR',

    // admin/rbac granular no expuesto aquí
    'ADMIN__MODULOS',
    'RBAC__ROLE_CREATE', 'RBAC__ROLE_EDIT', 'RBAC__ROLE_DELETE',
    'RBAC__PERM_VIEW', 'RBAC__PERM_EDIT',
    'RBAC__USER_PERMS_VIEW', 'RBAC__USER_PERMS_EDIT',
]);

function normCode(x: unknown): string {
    return String(x ?? '').trim().toUpperCase();
}

export default function EmpresaDetailPage() {
    const { id } = useParams();
    const idEmpresa = Number(id || 0);

    const [tab, setTab] = useState<'modulos' | 'permisos' | 'usuarios'>('modulos');

    const [mods, setMods] = useState<ModRow[]>([]);
    const [perms, setPerms] = useState<PermRow[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);

    // 👇 NUEVO: módulo seleccionado para la vista permisos
    const [selectedModuleKey, setSelectedModuleKey] = useState<string>(MODULE_SPECS[0]?.key ?? 'pos');

    // 👇 opcional: ver permisos que no están mapeados (por defecto: NO)
    const [showUnmapped, setShowUnmapped] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [m, p, u] = await Promise.all([
                getEmpresaModulos(idEmpresa),
                getEmpresaPermisos(idEmpresa),
                getEmpresaUsuarios(idEmpresa),
            ]);
            setMods(m.items ?? []);
            setPerms(p.items ?? []);
            setUsers(u.items ?? []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [idEmpresa]); // eslint-disable-line

    /** ===========================
     *  2) Índices y sets útiles
     *  ===========================
     */
    const permsByCode = useMemo(() => {
        const map = new Map<string, PermRow>();
        for (const p of perms) map.set(normCode(p.codigo), p);
        return map;
    }, [perms]);

    const usedPermSet = useMemo(() => {
        const all = MODULE_SPECS.flatMap(m => m.perms).map(normCode);
        const set = new Set(all);
        // quitar ocultos/legacy
        for (const h of UI_HIDDEN_PERMS) set.delete(h);
        return set;
    }, []);

    const filteredMods = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return mods;
        return mods.filter(m =>
            String(m.nombre ?? '').toLowerCase().includes(s) ||
            String(m.ruta ?? '').toLowerCase().includes(s)
        );
    }, [mods, q]);

    const filteredUsers = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return users;
        return users.filter(u =>
            String(u.nombre ?? '').toLowerCase().includes(s) ||
            String(u.apellido ?? '').toLowerCase().includes(s) ||
            String(u.email ?? '').toLowerCase().includes(s) ||
            String(u.documento ?? '').toLowerCase().includes(s) ||
            String(u.telefono ?? '').toLowerCase().includes(s)
        );
    }, [users, q]);

    const saveMods = async () => {
        const items = mods.map(m => ({ id_modulo: m.id_modulo, enabled: !!m.enabled }));
        const r = await saveEmpresaModulos(idEmpresa, items);
        await Swal.fire({ icon: 'success', title: 'Guardado', text: `Módulos guardados (${r.saved})` });
    };

    const savePerms = async () => {
        const items = perms.map(p => ({ id_permiso: p.id_permiso, enabled: !!p.enabled }));
        const r = await saveEmpresaPermisos(idEmpresa, items);
        await Swal.fire({ icon: 'success', title: 'Guardado', text: `Permisos guardados (${r.saved})` });
    };

    /** ===========================
     *  3) Permisos por módulo (solo usados)
     *  ===========================
     */
    const selectedModule = useMemo(() => {
        return MODULE_SPECS.find(m => m.key === selectedModuleKey) ?? MODULE_SPECS[0];
    }, [selectedModuleKey]);

    const modulePermRows = useMemo(() => {
        const s = q.trim().toLowerCase();
        const codes = (selectedModule?.perms ?? [])
            .map(normCode)
            .filter(c => usedPermSet.has(c)); // solo usados

        const rows = codes
            .map(code => {
                const row = permsByCode.get(code);
                return { code, row };
            })
            // puede que el permiso esté en el spec pero aún no exista en BD
            .filter(x => {
                if (!s) return true;
                const desc = x.row?.descripcion ?? '';
                return x.code.toLowerCase().includes(s) || String(desc).toLowerCase().includes(s);
            });

        return rows;
    }, [selectedModule, q, permsByCode, usedPermSet]);

    const moduleMissingInDb = useMemo(() => {
        return modulePermRows.filter(x => !x.row).map(x => x.code);
    }, [modulePermRows]);

    const moduleStats = useMemo(() => {
        const codes = (selectedModule?.perms ?? []).map(normCode).filter(c => usedPermSet.has(c));
        const total = codes.length;
        const enabled = codes.filter(c => permsByCode.get(c)?.enabled).length;
        return { total, enabled };
    }, [selectedModule, usedPermSet, permsByCode]);

    /** módulos list (con contadores) */
    const moduleListWithCounts = useMemo(() => {
        return MODULE_SPECS.map(ms => {
            const codes = ms.perms.map(normCode).filter(c => usedPermSet.has(c));
            const total = codes.length;
            const enabled = codes.filter(c => permsByCode.get(c)?.enabled).length;
            return { ...ms, total, enabled };
        });
    }, [permsByCode, usedPermSet]);

    /** permisos no mapeados (opcional, para auditoría) */
    const unmappedPermRows = useMemo(() => {
        if (!showUnmapped) return [];
        const s = q.trim().toLowerCase();
        return perms
            .filter(p => {
                const code = normCode(p.codigo);
                // no mapeados o ocultos
                return !usedPermSet.has(code);
            })
            .filter(p => {
                if (!s) return true;
                return normCode(p.codigo).toLowerCase().includes(s) || String(p.descripcion ?? '').toLowerCase().includes(s);
            });
    }, [perms, usedPermSet, showUnmapped, q]);

    return (
        <PageLayout
            title={`Empresa #${idEmpresa}`}
            right={<a className="btn btn-outline-secondary btn-sm" href="#/empresas">← Volver</a>}
        >
            <div className="d-flex gap-2 align-items-center mb-3 flex-wrap">
                <div className="btn-group">
                    <button
                        className={`btn btn-sm ${tab === 'modulos' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('modulos')}
                    >
                        Módulos
                    </button>
                    <button
                        className={`btn btn-sm ${tab === 'permisos' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('permisos')}
                    >
                        Permisos
                    </button>
                    <button
                        className={`btn btn-sm ${tab === 'usuarios' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('usuarios')}
                    >
                        Usuarios
                    </button>
                </div>

                <input
                    className="form-control"
                    placeholder={
                        tab === 'modulos'
                            ? 'Filtrar módulos...'
                            : tab === 'permisos'
                                ? 'Buscar en permisos del módulo...'
                                : 'Buscar usuarios...'
                    }
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ maxWidth: 420 }}
                />

                <div className="ms-auto d-flex gap-2 align-items-center">
                    {tab === 'permisos' && (
                        <div className="form-check form-switch">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={showUnmapped}
                                onChange={(e) => setShowUnmapped(e.target.checked)}
                                id="showUnmapped"
                            />
                            <label className="form-check-label" htmlFor="showUnmapped" style={{ fontSize: 12 }}>
                                Mostrar no mapeados
                            </label>
                        </div>
                    )}

                    {tab === 'modulos' ? (
                        <button className="btn btn-primary btn-sm" onClick={saveMods} disabled={loading}>
                            Guardar módulos
                        </button>
                    ) : tab === 'permisos' ? (
                        <button className="btn btn-primary btn-sm" onClick={savePerms} disabled={loading}>
                            Guardar permisos
                        </button>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <div className="py-4">Cargando…</div>
            ) : tab === 'modulos' ? (
                <div className="table-responsive">
                    <table className="table table-sm align-middle">
                        <thead>
                            <tr>
                                <th style={{ width: 90 }}>ID</th>
                                <th>Módulo</th>
                                <th>Ruta</th>
                                <th style={{ width: 110 }}>Enabled</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMods.map(m => (
                                <tr key={m.id_modulo}>
                                    <td>{m.id_modulo}</td>
                                    <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                                    <td style={{ fontSize: 12, opacity: 0.8 }}>{m.ruta || '-'}</td>
                                    <td>
                                        <input
                                            type="checkbox"
                                            className="form-check-input"
                                            checked={!!m.enabled}
                                            onChange={(e) => {
                                                const v = e.target.checked;
                                                setMods(prev => prev.map(x => x.id_modulo === m.id_modulo ? { ...x, enabled: v } : x));
                                            }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : tab === 'permisos' ? (
                // ✅ NUEVO: UI permisos por módulo (click -> lista)
                <div className="row g-3">
                    {/* Columna izquierda: módulos */}
                    <div className="col-12 col-lg-4">
                        <div className="card">
                            <div className="card-body">
                                <div className="fw-bold mb-2">Módulos</div>

                                <div className="list-group">
                                    {moduleListWithCounts.map(ms => {
                                        const active = ms.key === selectedModuleKey;
                                        return (
                                            <button
                                                key={ms.key}
                                                type="button"
                                                className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${active ? 'active' : ''}`}
                                                onClick={() => setSelectedModuleKey(ms.key)}
                                            >
                                                <div className="d-flex flex-column text-start">
                                                    <span style={{ fontWeight: 700 }}>{ms.label}</span>
                                                    <span style={{ fontSize: 12, opacity: active ? 0.95 : 0.7 }}>
                                                        {ms.enabled}/{ms.total} habilitados
                                                    </span>
                                                </div>
                                                <span className={`badge ${active ? 'bg-light text-dark' : 'bg-secondary'}`}>
                                                    {ms.total}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                                    Solo se muestran permisos “usados” por el sistema (mapeados a módulos).
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Columna derecha: permisos del módulo */}
                    <div className="col-12 col-lg-8">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                                    <div>
                                        <div className="fw-bold">{selectedModule?.label ?? 'Módulo'}</div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            {moduleStats.enabled}/{moduleStats.total} habilitados · haz click para activar/desactivar
                                        </div>
                                    </div>
                                </div>

                                {moduleMissingInDb.length > 0 && (
                                    <div className="alert alert-warning py-2 mt-3">
                                        <small>
                                            ⚠️ Hay permisos definidos en el módulo que no existen en la BD:
                                            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                                                {' '}
                                                {moduleMissingInDb.join(', ')}
                                            </span>
                                        </small>
                                    </div>
                                )}

                                <div className="table-responsive mt-3">
                                    <table className="table table-sm align-middle">
                                        <thead>
                                            <tr>
                                                <th>Código</th>
                                                <th>Descripción</th>
                                                <th style={{ width: 110 }}>Enabled</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {modulePermRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="text-muted py-3">
                                                        No hay permisos para mostrar (revisa filtro o el mapeo del módulo).
                                                    </td>
                                                </tr>
                                            ) : (
                                                modulePermRows.map(({ code, row }) => (
                                                    <tr key={code}>
                                                        <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
                                                            {code}
                                                        </td>
                                                        <td style={{ fontSize: 12, opacity: 0.85 }}>
                                                            {row?.descripcion ?? <span className="text-muted">No existe en BD</span>}
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                checked={!!row?.enabled}
                                                                disabled={!row}
                                                                onChange={(e) => {
                                                                    if (!row) return;
                                                                    const v = e.target.checked;
                                                                    setPerms(prev => prev.map(x => normCode(x.codigo) === code ? { ...x, enabled: v } : x));
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Opcional: no mapeados */}
                                {showUnmapped && (
                                    <div className="mt-4">
                                        <div className="fw-bold mb-2">Permisos no mapeados / legacy (auditoría)</div>
                                        <div className="text-muted mb-2" style={{ fontSize: 12 }}>
                                            Esto es solo para inspección. Por defecto no se muestran para mantener la UI limpia.
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-sm align-middle">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: 90 }}>ID</th>
                                                        <th>Código</th>
                                                        <th>Descripción</th>
                                                        <th style={{ width: 110 }}>Enabled</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {unmappedPermRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="text-muted py-3">No hay permisos no mapeados con este filtro.</td>
                                                        </tr>
                                                    ) : (
                                                        unmappedPermRows.map(p => (
                                                            <tr key={p.id_permiso}>
                                                                <td>{p.id_permiso}</td>
                                                                <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
                                                                    {normCode(p.codigo)}
                                                                </td>
                                                                <td style={{ fontSize: 12, opacity: 0.85 }}>{p.descripcion}</td>
                                                                <td>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="form-check-input"
                                                                        checked={!!p.enabled}
                                                                        onChange={(e) => {
                                                                            const v = e.target.checked;
                                                                            setPerms(prev => prev.map(x => x.id_permiso === p.id_permiso ? { ...x, enabled: v } : x));
                                                                        }}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="table table-sm align-middle">
                        <thead>
                            <tr>
                                <th style={{ width: 80 }}>ID</th>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Documento</th>
                                <th>Teléfono</th>
                                <th style={{ width: 120 }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-muted py-3">
                                        No hay usuarios para esta empresa.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((u) => (
                                    <tr key={u.id_usuario}>
                                        <td>{u.id_usuario}</td>
                                        <td style={{ fontWeight: 600 }}>
                                            {u.nombre} {u.apellido ? String(u.apellido) : ''}
                                        </td>
                                        <td>{u.email}</td>
                                        <td>{u.documento || '-'}</td>
                                        <td>{u.telefono || '-'}</td>
                                        <td>
                                            {Number(u.estado) === 1 ? (
                                                <span className="badge bg-success">Activo</span>
                                            ) : (
                                                <span className="badge bg-secondary">Inactivo</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </PageLayout>
    );
}
