import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import PageLayout from '../../layout/PageLayout';
import {
    getEmpresaModulos,
    saveEmpresaModulos,
    getEmpresaPermisos,
    saveEmpresaPermisos,
    getEmpresaUsuarios,
    getEmpresaConfiguracionNegocio,
    saveEmpresaConfiguracionNegocio,
    downloadInventarioInicialTemplate,
    previewInventarioInicialImport,
    confirmInventarioInicialImport,
    type EmpresaConfiguracionNegocio,
    type EmpresaCapacidadDetalle,
    type EmpresaModuloItem,
    type EmpresaPermisoItem,
    type TipoNegocio,
    type EmpresaUsuarioItem,
    type InventarioImportPreview,
} from '../../api/adminEmpresas';
import { getTenantHealth, type TenantHealthItem } from '../../api/adminTenantHealth';
import { isSyncPending } from '../../api/adminSaas';
import SaasSubscriptionPanel from './SaasSubscriptionPanel';

type ModRow = EmpresaModuloItem;
type PermRow = EmpresaPermisoItem;
type UserRow = EmpresaUsuarioItem;
type CapRow = EmpresaCapacidadDetalle;

const SAAS_MANAGED_CAPABILITY_CODES = new Set([
    'SOPORTE_TECNICO',
    'PRECONTABILIDAD',
    'EXPORTACION_CONTABLE',
    'FACTURACION_ELECTRONICA',
    'NOTAS_FISCALES',
]);

const BUSINESS_TYPE_OPTIONS: Array<{ value: TipoNegocio; label: string; help: string }> = [
    {
        value: 'GENERAL',
        label: 'Otro negocio',
        help: 'Configuración general para ferreterías, misceláneas, autopartes, tiendas de ropa y otros negocios con venta por unidad.',
    },
    {
        value: 'DROGUERIA',
        label: 'Droguería',
        help: 'Activa lotes, vencimientos y el registro y la venta por presentaciones, como caja, blíster y unidad.',
    },
    {
        value: 'TIENDA_MINIMARKET',
        label: 'Tienda / minimarket',
        help: 'Activa lotes, vencimientos y el registro y la venta de productos por peso (kg).',
    },
];

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
    capabilityCode?: string;
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
        perms: ['BANCOS__VER', 'BANCOS__MOVIMIENTO', 'BANCOS__CUENTA_CREAR', 'BANCOS__CUENTA_EDITAR', 'BANCOS__CUENTA_DESACTIVAR']
    },
    {
        key: 'gastos',
        label: 'Gastos',
        icon: 'request_quote',
        perms: [
            'GASTOS__VER',
            'GASTOS__CREAR',
            'GASTOS__EDITAR',
            'GASTOS__ANULAR',
            'GASTOS__EXPORTAR',
            'GASTOS__CATEGORIAS_EDITAR',
        ],
    },
    {
        key: 'precontabilidad',
        label: 'Precontabilidad',
        icon: 'account_balance',
        perms: ['PRECONTABILIDAD__VER', 'PRECONTABILIDAD__CONFIGURAR'],
        capabilityCode: 'PRECONTABILIDAD',
    },
    {
        key: 'soporte',
        label: 'Soporte',
        icon: 'support_agent',
        perms: ['SOPORTE__VER', 'SOPORTE__CREAR', 'SOPORTE__EDITAR', 'SOPORTE__ENTREGAR', 'SOPORTE__EXPORTAR', 'SOPORTE__ENVIAR', 'WHATSAPP__SOPORTE_ENVIAR_COMPROBANTE'],
        capabilityCode: 'SOPORTE_TECNICO',
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
    'CONTABLES__VER', 'CONTABLES__EXPORTAR',
    'VENTA__DETALLE',
    'INVENTARIO__MOV_EXPORTAR', 'INVENTARIO__LOTE_EDITAR',

    // admin/rbac granular no expuesto aquí
    'ADMIN__MODULOS',
    'RBAC__ROLE_CREATE', 'RBAC__ROLE_EDIT', 'RBAC__ROLE_DELETE',
    'RBAC__PERM_VIEW', 'RBAC__PERM_EDIT',
    'RBAC__USER_PERMS_VIEW', 'RBAC__USER_PERMS_EDIT',
]);

const RETIRED_MODULE_ROUTES = new Set(['/reportes-contables', 'reportes-contables']);
const SAAS_MODULE_GATES: Record<string, { capabilityCode: string; label: string }> = {
    soporte: { capabilityCode: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
    precontabilidad: { capabilityCode: 'PRECONTABILIDAD', label: 'Precontabilidad' },
};
const SAAS_PERMISSION_GATES: Record<string, { capabilityCode: string; label: string }> = {
    SOPORTE__VER: { capabilityCode: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
    SOPORTE__CREAR: { capabilityCode: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
    SOPORTE__EDITAR: { capabilityCode: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
    SOPORTE__ENTREGAR: { capabilityCode: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
    SOPORTE__EXPORTAR: { capabilityCode: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
    SOPORTE__ENVIAR: { capabilityCode: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
    WHATSAPP__SOPORTE_ENVIAR_COMPROBANTE: { capabilityCode: 'SOPORTE_TECNICO', label: 'Soporte tecnico' },
    PRECONTABILIDAD__VER: { capabilityCode: 'PRECONTABILIDAD', label: 'Precontabilidad' },
    PRECONTABILIDAD__CONFIGURAR: { capabilityCode: 'PRECONTABILIDAD', label: 'Precontabilidad' },
};

function normCode(x: unknown): string {
    return String(x ?? '').trim().toUpperCase();
}

function normSearch(x: unknown): string {
    return String(x ?? '').trim().toLowerCase();
}

function isRetiredReportsModule(module: ModRow): boolean {
    const route = normSearch(module.ruta).replace(/^#/, '');
    const name = normSearch(module.nombre);
    return RETIRED_MODULE_ROUTES.has(route) || name === 'reportes contables';
}

function moduleGateKey(module: ModRow): string | null {
    const route = normSearch(module.ruta);
    const name = normSearch(module.nombre);
    if (route.includes('soporte') || name.includes('soporte')) return 'soporte';
    if (route.includes('precontabilidad') || name.includes('precontabilidad')) return 'precontabilidad';
    return null;
}

function moduleSpecForModule(module: ModRow): ModSpec | null {
    const route = normSearch(module.ruta);
    const name = normSearch(module.nombre);
    return MODULE_SPECS.find((spec) => {
        const key = normSearch(spec.key);
        const label = normSearch(spec.label);
        return route.includes(key) || name === label || name.includes(label);
    }) ?? null;
}

function permissionKind(code: string): { label: string; className: string } {
    if (code === 'PRECONTABILIDAD__CONFIGURAR') {
        return { label: 'Configuracion', className: 'text-bg-warning' };
    }
    if (code === 'PRECONTABILIDAD__VER') {
        return { label: 'Consulta', className: 'text-bg-info' };
    }
    if (code.endsWith('__CONFIGURAR') || code.endsWith('__EDITAR') || code.endsWith('__CREAR')) {
        return { label: 'Gestion', className: 'text-bg-warning' };
    }
    return { label: 'Consulta', className: 'text-bg-light border text-dark' };
}

function dateText(value?: string | null): string {
    if (!value) return '-';
    return String(value).replace('T', ' ').replace('Z', '');
}

function tenantHealthBadge(status?: string | null): string {
    if (status === 'OK') return 'badge bg-success';
    if (status === 'WARNING') return 'badge bg-warning text-dark';
    if (status === 'ERROR') return 'badge bg-danger';
    return 'badge bg-secondary';
}

function tenantHealthLabel(status?: string | null): string {
    if (status === 'OK') return 'OK';
    if (status === 'WARNING') return 'Alerta';
    if (status === 'ERROR') return 'Error';
    return 'Sin verificar';
}

function responseData(error: unknown): { error?: unknown; message?: unknown } | null {
    if (typeof error !== 'object' || error === null || !('response' in error)) return null;
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;
    return typeof data === 'object' && data !== null ? data as { error?: unknown; message?: unknown } : null;
}

function isSaasCapabilityValidation(error: unknown): boolean {
    const data = responseData(error);
    const message = String(data?.message ?? data?.error ?? '');
    return message.includes('CAPACIDAD_SAAS_REQUERIDA');
}

export default function EmpresaDetailPage() {
    const { id } = useParams();
    const idEmpresa = Number(id || 0);

    const [tab, setTab] = useState<'configuracion' | 'modulos' | 'usuarios' | 'suscripcion'>('configuracion');

    const [mods, setMods] = useState<ModRow[]>([]);
    const [perms, setPerms] = useState<PermRow[]>([]);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [businessConfig, setBusinessConfig] = useState<EmpresaConfiguracionNegocio | null>(null);
    const [tenantHealth, setTenantHealth] = useState<TenantHealthItem | null>(null);
    const [tenantChecking, setTenantChecking] = useState(false);
    const [inventoryImportFile, setInventoryImportFile] = useState<File | null>(null);
    const [inventoryImportPreview, setInventoryImportPreview] = useState<InventarioImportPreview | null>(null);
    const [inventoryImportChecking, setInventoryImportChecking] = useState(false);
    const [inventoryImportConfirming, setInventoryImportConfirming] = useState(false);
    const [tipoNegocio, setTipoNegocio] = useState<TipoNegocio>('GENERAL');
    const [capabilityValues, setCapabilityValues] = useState<Record<string, boolean>>({});
    const [q, setQ] = useState('');
    const [permQ, setPermQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [operationalNotice, setOperationalNotice] = useState<string | null>(null);

    // NUEVO: módulo seleccionado para la vista permisos
    const [selectedModuleKey, setSelectedModuleKey] = useState<string | null>(null);

    // opcional: ver permisos que no están mapeados (por defecto: NO)
    const load = async () => {
        setLoading(true);
        try {
            const [m, p, u, c] = await Promise.all([
                getEmpresaModulos(idEmpresa),
                getEmpresaPermisos(idEmpresa),
                getEmpresaUsuarios(idEmpresa),
                getEmpresaConfiguracionNegocio(idEmpresa),
            ]);
            setMods(m.items ?? []);
            setPerms(p.items ?? []);
            setUsers(u.items ?? []);
            setBusinessConfig(c);
            setTenantHealth(null);
            setTipoNegocio(c.tipo_negocio ?? 'GENERAL');
            setCapabilityValues(c.capacidades ?? {});
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

    const effectiveCapabilities = useMemo(() => {
        const map = new Map<string, boolean>();
        for (const [code, enabled] of Object.entries(businessConfig?.capacidades ?? {})) {
            map.set(normCode(code), Boolean(enabled));
        }
        for (const cap of businessConfig?.capacidades_detalle ?? []) {
            const code = normCode(cap.codigo_capacidad);
            if (!map.has(code)) {
                map.set(code, Boolean(cap.enabled));
            }
        }
        return map;
    }, [businessConfig]);

    const isCapabilityEffective = useCallback((code?: string | null): boolean => {
        if (!code) return true;
        return effectiveCapabilities.get(normCode(code)) === true;
    }, [effectiveCapabilities]);

    const isModuleRestrictedByCapability = useCallback((module: ModRow): boolean => {
        const gate = moduleGateKey(module);
        if (!gate) return false;
        const rule = SAAS_MODULE_GATES[gate];
        return rule ? !isCapabilityEffective(rule.capabilityCode) : false;
    }, [isCapabilityEffective]);

    const isPermissionRestrictedByCapability = useCallback((code: string): boolean => {
        const rule = SAAS_PERMISSION_GATES[normCode(code)];
        return rule ? !isCapabilityEffective(rule.capabilityCode) : false;
    }, [isCapabilityEffective]);

    const permissionEnabledForDisplay = useCallback((code: string): boolean => {
        return Boolean(permsByCode.get(normCode(code))?.enabled);
    }, [permsByCode]);

    const usedPermSet = useMemo(() => {
        const all = MODULE_SPECS.flatMap(m => m.perms).map(normCode);
        const set = new Set(all);
        // quitar ocultos/legacy
        for (const h of UI_HIDDEN_PERMS) set.delete(h);
        return set;
    }, []);

    const filteredMods = useMemo(() => {
        const s = q.trim().toLowerCase();
        const visible = mods.filter((m) => !isRetiredReportsModule(m));
        if (!s) return visible;
        return visible.filter(m =>
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

    const filteredCapabilities = useMemo(() => {
        const rows = (businessConfig?.capacidades_detalle ?? []).filter(
            (cap) => !SAAS_MANAGED_CAPABILITY_CODES.has(normCode(cap.codigo_capacidad))
        );
        const s = q.trim().toLowerCase();
        if (!s) return rows;
        return rows.filter((cap: CapRow) =>
            normCode(cap.codigo_capacidad).toLowerCase().includes(s) ||
            String(cap.nombre ?? '').toLowerCase().includes(s) ||
            String(cap.descripcion ?? '').toLowerCase().includes(s)
        );
    }, [businessConfig, q]);

    const saveMods = async () => {
        const items = mods.map(m => ({
            id_modulo: m.id_modulo,
            enabled: !isRetiredReportsModule(m) && !!m.enabled,
        }));
        try {
            const r = await saveEmpresaModulos(idEmpresa, items);
            await load();
            if (isSyncPending(r.sync)) {
                setOperationalNotice('Los cambios locales fueron guardados y el tenant sera sincronizado automaticamente mediante reintento.');
                return;
            }
            setOperationalNotice(null);
            await Swal.fire({ icon: 'success', title: 'Guardado', text: `Modulos guardados (${r.saved})` });
        } catch (error: unknown) {
            if (isSaasCapabilityValidation(error)) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Capacidad SaaS requerida',
                    text: 'Este recurso requiere una capacidad que no esta incluida en el plan o la suscripcion de la empresa.',
                    confirmButtonText: 'Entendido',
                });
                return;
            }
            await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron guardar los modulos.' });
        }
    };

    const savePerms = async () => {
        const items = perms.map(p => ({
            id_permiso: p.id_permiso,
            enabled: !UI_HIDDEN_PERMS.has(normCode(p.codigo)) && !!p.enabled,
        }));
        try {
            const r = await saveEmpresaPermisos(idEmpresa, items);
            await load();
            if (isSyncPending(r.sync)) {
                setOperationalNotice('Los cambios locales fueron guardados y el tenant sera sincronizado automaticamente mediante reintento.');
                return;
            }
            setOperationalNotice(null);
            await Swal.fire({ icon: 'success', title: 'Guardado', text: `Permisos guardados (${r.saved})` });
        } catch (error: unknown) {
            if (isSaasCapabilityValidation(error)) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Capacidad SaaS requerida',
                    text: 'Este recurso requiere una capacidad que no esta incluida en el plan o la suscripcion de la empresa.',
                    confirmButtonText: 'Entendido',
                });
                return;
            }
            await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron guardar los permisos.' });
        }
    };


    const verifyTenant = async () => {
        setTenantChecking(true);
        void Swal.fire({
            title: 'Verificando tenant',
            text: 'Revisando conexion, tablas, conteos y actividad reciente.',
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading(),
        });

        try {
            const out = await getTenantHealth(idEmpresa, false);
            setTenantHealth(out.item);
            const icon = out.item.health_status === 'OK' ? 'success' : out.item.health_status === 'WARNING' ? 'warning' : 'error';
            await Swal.fire({
                icon,
                title: `Resultado: ${tenantHealthLabel(out.item.health_status)}`,
                text: out.item.errors?.[0] || out.item.warnings?.[0] || 'Tenant verificado correctamente.',
                confirmButtonText: 'Entendido',
            });
        } catch {
            await Swal.fire('Error', 'No se pudo verificar el tenant de esta empresa.', 'error');
        } finally {
            setTenantChecking(false);
        }
    };
    const saveBusinessConfig = async () => {
        const operationalCapabilities = Object.fromEntries(
            Object.entries(capabilityValues).filter(([code]) => !SAAS_MANAGED_CAPABILITY_CODES.has(normCode(code)))
        );
        const r = await saveEmpresaConfiguracionNegocio(idEmpresa, {
            tipo_negocio: tipoNegocio,
            capacidades: operationalCapabilities,
        });
        setBusinessConfig(r);
        setTipoNegocio(r.tipo_negocio ?? 'GENERAL');
        setCapabilityValues(r.capacidades ?? {});
        await load();
        await Swal.fire({ icon: 'success', title: 'Guardado', text: 'Configuración de negocio actualizada' });
    };

    const downloadTemplate = async () => {
        try {
            await downloadInventarioInicialTemplate(idEmpresa);
        } catch {
            await Swal.fire({
                icon: 'error',
                title: 'No se pudo descargar',
                text: 'Intenta verificar la empresa y vuelve a generar la plantilla.',
            });
        }
    };

    const previewInventoryImport = async () => {
        if (!inventoryImportFile) {
            await Swal.fire({
                icon: 'warning',
                title: 'Selecciona un archivo',
                text: 'Primero elige la plantilla Excel diligenciada.',
            });
            return;
        }

        setInventoryImportChecking(true);
        setInventoryImportPreview(null);
        try {
            const out = await previewInventarioInicialImport(idEmpresa, inventoryImportFile);
            setInventoryImportPreview(out);
            if (out.summary?.can_confirm) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Archivo validado',
                    text: `${out.summary.valid_rows} productos listos para importar en el siguiente paso.`,
                });
            } else {
                await Swal.fire({
                    icon: out.summary?.rows_read ? 'warning' : 'error',
                    title: 'Revisa el archivo',
                    text: out.errors?.[0]?.message || 'Hay datos por corregir antes de importar.',
                });
            }
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            await Swal.fire({
                icon: 'error',
                title: 'No se pudo leer el archivo',
                text: message || 'Verifica que sea la plantilla Excel descargada desde este panel.',
            });
        } finally {
            setInventoryImportChecking(false);
        }
    };

    const confirmInventoryImport = async () => {
        if (!inventoryImportFile || !inventoryImportPreview?.summary?.can_confirm) {
            await Swal.fire({
                icon: 'warning',
                title: 'Primero previsualiza',
                text: 'Valida el archivo y corrige errores antes de confirmar la importacion.',
            });
            return;
        }

        const answer = await Swal.fire({
            icon: 'warning',
            title: 'Confirmar importacion',
            html: `
                <div style="text-align:left">
                    <p>Se crearan <b>${inventoryImportPreview.summary.valid_rows}</b> productos con inventario inicial en el tenant de esta empresa.</p>
                    <p>Esta accion tambien puede crear categorias, proveedores, unidades, impuestos, lotes y presentaciones si vienen en el archivo.</p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Si, importar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2563eb',
        });

        if (!answer.isConfirmed) {
            return;
        }

        setInventoryImportConfirming(true);
        try {
            const out = await confirmInventarioInicialImport(idEmpresa, inventoryImportFile);
            if (out.preview) {
                setInventoryImportPreview(out.preview);
            }
            if (!out.ok) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'No se pudo importar',
                    text: out.message || 'El archivo aun tiene datos por corregir.',
                });
                return;
            }

            setInventoryImportFile(null);
            setInventoryImportPreview(null);
            await Swal.fire({
                icon: 'success',
                title: 'Inventario importado',
                html: `
                    <div style="text-align:left">
                        <p>Registro inicial: <b>#${out.id_inicial ?? '-'}</b></p>
                        <p>Productos: <b>${out.summary?.productos_creados ?? 0}</b></p>
                        <p>Lotes: <b>${out.summary?.lotes_creados ?? 0}</b></p>
                        <p>Presentaciones: <b>${out.summary?.presentaciones_creadas ?? 0}</b></p>
                    </div>
                `,
            });
        } catch (err: unknown) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            await Swal.fire({
                icon: 'error',
                title: 'Error importando',
                text: message || 'No se pudo confirmar la importacion.',
            });
        } finally {
            setInventoryImportConfirming(false);
        }
    };

    /** ===========================
     *  3) Permisos por módulo (solo usados)
     *  ===========================
     */
    const selectedModule = useMemo(() => {
        if (!selectedModuleKey) return null;
        return MODULE_SPECS.find(m => m.key === selectedModuleKey) ?? null;
    }, [selectedModuleKey]);

    const selectedModuleRestricted = Boolean(
        selectedModule?.capabilityCode && !isCapabilityEffective(selectedModule.capabilityCode)
    );

    const modulePermRows = useMemo(() => {
        const s = permQ.trim().toLowerCase();
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
    }, [selectedModule, permQ, permsByCode, usedPermSet]);

    const moduleMissingInDb = useMemo(() => {
        return modulePermRows.filter(x => !x.row).map(x => x.code);
    }, [modulePermRows]);

    const moduleStats = useMemo(() => {
        const codes = (selectedModule?.perms ?? []).map(normCode).filter(c => usedPermSet.has(c));
        const total = codes.length;
        const enabled = codes.filter(c => permissionEnabledForDisplay(c)).length;
        return { total, enabled };
    }, [selectedModule, usedPermSet, permissionEnabledForDisplay]);

    /** módulos list (con contadores) */
    /** permisos no mapeados (opcional, para auditoría) */
    const selectedBusinessTypeOption = useMemo(() => {
        return BUSINESS_TYPE_OPTIONS.find((opt) => opt.value === tipoNegocio) ?? BUSINESS_TYPE_OPTIONS[0];
    }, [tipoNegocio]);

    const tenant = businessConfig?.tenant ?? null;

    return (
        <PageLayout
            title={`Empresa #${idEmpresa}`}
            right={<a className="btn btn-outline-secondary btn-sm" href="#/empresas">Volver</a>}
        >
            <div className="d-flex gap-2 align-items-center mb-3 flex-wrap">
                <div className="btn-group">
                    <button
                        className={`btn btn-sm ${tab === 'configuracion' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('configuracion')}
                    >
                        Configuración
                    </button>
                    <button
                        className={`btn btn-sm ${tab === 'modulos' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('modulos')}
                    >
                        Módulos
                    </button>
                    <button
                        className={`btn btn-sm ${tab === 'usuarios' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('usuarios')}
                    >
                        Usuarios
                    </button>
                    <button
                        className={`btn btn-sm ${tab === 'suscripcion' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => setTab('suscripcion')}
                    >
                        Suscripcion
                    </button>
                </div>

                <input
                    className="form-control"
                    placeholder={
                        tab === 'configuracion'
                            ? 'Buscar capacidades...'
                            : tab === 'modulos'
                                ? 'Filtrar módulos...'
                                    : 'Buscar usuarios...'
                    }
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    style={{ maxWidth: 420 }}
                />

                <div className="ms-auto d-flex gap-2 align-items-center">
                    {tab === 'configuracion' ? (
                        <button className="btn btn-primary btn-sm" onClick={saveBusinessConfig} disabled={loading || !businessConfig}>
                            Guardar configuración
                        </button>
                    ) : tab === 'modulos' ? (
                        <button className="btn btn-primary btn-sm" onClick={saveMods} disabled={loading}>
                            Guardar módulos
                        </button>
                    ) : null}
                </div>
            </div>

            {operationalNotice && (
                <div className="alert alert-info py-2 mb-3 small">
                    {operationalNotice}
                </div>
            )}

            {loading ? (
                <div className="py-4">Cargando...</div>
            ) : tab === 'suscripcion' ? (
                <SaasSubscriptionPanel idEmpresa={idEmpresa} onSynced={load} />
            ) : tab === 'configuracion' ? (
                <div className="row g-3">
                    <div className="col-12 col-lg-5">
                        <div className="card">
                            <div className="card-body">
                                <div className="fw-bold mb-2">Tipo de negocio</div>
                                <select
                                    className="form-select"
                                    value={tipoNegocio}
                                    onChange={(e) => setTipoNegocio(e.target.value as TipoNegocio)}
                                >
                                    {BUSINESS_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>

                                <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                                    {selectedBusinessTypeOption?.help}
                                </div>

                                <div className="border-top pt-3 mt-3">
                                    <div className="fw-bold mb-1">Empresa</div>
                                    <div style={{ fontSize: 13 }}>
                                        {businessConfig?.nombre ?? `Empresa #${idEmpresa}`}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: 12 }}>
                                        ID {idEmpresa}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card mt-3">
                            <div className="card-body">
                                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-3">
                                    <div>
                                        <div className="fw-bold">Tenant multibase</div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            Datos reales de conexion y estado del mapping.
                                        </div>
                                    </div>
                                    <span className={tenant?.estado === 'ACTIVE' ? 'badge bg-success' : 'badge bg-secondary'}>
                                        {tenant?.estado ?? 'SIN_MAPPING'}
                                    </span>
                                </div>

                                {!tenant ? (
                                    <div className="alert alert-warning py-2 mb-0" style={{ fontSize: 13 }}>
                                        Esta empresa no tiene tenant asignado en admin.tenant_database.
                                    </div>
                                ) : (
                                    <>
                                        <div className="row g-2 small">
                                            <div className="col-12">
                                                <div className="text-muted">Base de datos</div>
                                                <code>{tenant.db_name || '-'}</code>
                                            </div>
                                            <div className="col-6">
                                                <div className="text-muted">Usuario BD</div>
                                                <code>{tenant.db_user || '-'}</code>
                                            </div>
                                            <div className="col-6">
                                                <div className="text-muted">Schema</div>
                                                <code>{tenant.db_schema || '-'}</code>
                                            </div>
                                            <div className="col-6">
                                                <div className="text-muted">Creado</div>
                                                <div>{dateText(tenant.created_at)}</div>
                                            </div>
                                            <div className="col-6">
                                                <div className="text-muted">Actualizado</div>
                                                <div>{dateText(tenant.updated_at)}</div>
                                            </div>
                                            <div className="col-12">
                                                <div className="text-muted">Ultimo check</div>
                                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                                    <span>{dateText(tenantHealth?.checked_at)}</span>
                                                    <span className={tenantHealthBadge(tenantHealth?.health_status)}>
                                                        {tenantHealthLabel(tenantHealth?.health_status)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="d-flex gap-2 flex-wrap mt-3">
                                            <button
                                                type="button"
                                                className="btn btn-outline-primary btn-sm"
                                                onClick={verifyTenant}
                                                disabled={tenantChecking}
                                            >
                                                {tenantChecking ? 'Verificando...' : 'Verificar tenant'}
                                            </button>
                                            <a className="btn btn-outline-secondary btn-sm" href="#/salud-tenants">
                                                Abrir salud multibase
                                            </a>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                    </div>

                    <div className="col-12 col-lg-7">
                        <div className="card">
                            <div className="card-body">
                                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                                    <div>
                                        <div className="fw-bold">Capacidades</div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            Activa o desactiva funciones especiales para esta empresa.
                                        </div>
                                    </div>
                                </div>

                                <div className="table-responsive mt-3">
                                    <table className="table table-sm align-middle">
                                        <thead>
                                            <tr>
                                                <th>Capacidad</th>
                                                <th>Descripción</th>
                                                <th style={{ width: 110 }}>Habilitar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredCapabilities.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="text-muted py-3">
                                                        No hay capacidades para mostrar.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredCapabilities.map((cap) => {
                                                    const code = normCode(cap.codigo_capacidad);
                                                    const enabled = capabilityValues[code] ?? !!cap.enabled;
                                                    return (
                                                        <tr key={code}>
                                                            <td>
                                                                <div style={{ fontWeight: 700 }}>{cap.nombre}</div>
                                                                <div className="text-muted" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
                                                                    {code}
                                                                </div>
                                                            </td>
                                                            <td style={{ fontSize: 12, opacity: 0.85 }}>
                                                                {cap.descripcion || '-'}
                                                            </td>
                                                            <td>
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input"
                                                                    checked={enabled}
                                                                    onChange={(e) => {
                                                                        const v = e.target.checked;
                                                                        setCapabilityValues((prev) => ({ ...prev, [code]: v }));
                                                                    }}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="text-muted" style={{ fontSize: 12 }}>
                                    Productos por peso queda marcada como reservada hasta terminar el flujo completo de kg.
                                </div>
                            </div>
                        </div>
                        <div className="card mt-3">
                            <div className="card-body">
                                <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                                    <div>
                                        <div className="fw-bold">Implementacion inicial</div>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            Plantilla organizada segun el tipo de negocio y sus capacidades activas.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline-primary btn-sm"
                                        onClick={downloadTemplate}
                                        disabled={!businessConfig}
                                    >
                                        Descargar plantilla Excel
                                    </button>
                                </div>
                                <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                                    Incluye columnas obligatorias, campos opcionales y columnas especiales para lotes, peso o presentaciones cuando apliquen.
                                </div>
                                <div className="border-top mt-3 pt-3">
                                    <div className="fw-bold mb-1">Previsualizar archivo diligenciado</div>
                                    <div className="text-muted mb-2" style={{ fontSize: 12 }}>
                                        La previsualizacion valida el Excel y busca errores antes de crear productos o inventario.
                                    </div>
                                    <input
                                        type="file"
                                        className="form-control form-control-sm"
                                        accept=".xlsx"
                                        onChange={(e) => {
                                            setInventoryImportFile(e.target.files?.[0] ?? null);
                                            setInventoryImportPreview(null);
                                        }}
                                    />
                                    <div className="d-flex gap-2 flex-wrap mt-2">
                                        <button
                                            type="button"
                                            className="btn btn-outline-success btn-sm"
                                            onClick={previewInventoryImport}
                                            disabled={inventoryImportChecking || inventoryImportConfirming || !inventoryImportFile}
                                        >
                                            {inventoryImportChecking ? 'Validando...' : 'Previsualizar archivo'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-success btn-sm"
                                            onClick={confirmInventoryImport}
                                            disabled={
                                                inventoryImportChecking
                                                || inventoryImportConfirming
                                                || !inventoryImportFile
                                                || !inventoryImportPreview?.summary?.can_confirm
                                            }
                                        >
                                            {inventoryImportConfirming ? 'Importando...' : 'Confirmar importacion'}
                                        </button>
                                        {inventoryImportFile && (
                                            <span className="text-muted align-self-center" style={{ fontSize: 12 }}>
                                                {inventoryImportFile.name}
                                            </span>
                                        )}
                                    </div>

                                    {inventoryImportPreview && (
                                        <div className="mt-3">
                                            <div className="d-flex gap-2 flex-wrap mb-2">
                                                <span className="badge text-bg-light border">Leidas: {inventoryImportPreview.summary.rows_read}</span>
                                                <span className="badge text-bg-success">Validas: {inventoryImportPreview.summary.valid_rows}</span>
                                                <span className="badge text-bg-danger">Con errores: {inventoryImportPreview.summary.rows_with_errors}</span>
                                                <span className="badge text-bg-warning">Advertencias: {inventoryImportPreview.summary.warnings}</span>
                                            </div>

                                            {inventoryImportPreview.summary.can_confirm ? (
                                                <div className="alert alert-success py-2" style={{ fontSize: 13 }}>
                                                    Archivo listo para confirmar en el siguiente paso. Aun no se ha insertado nada.
                                                </div>
                                            ) : (
                                                <div className="alert alert-warning py-2" style={{ fontSize: 13 }}>
                                                    Corrige los errores antes de importar. Aun no se ha insertado nada.
                                                </div>
                                            )}

                                            {inventoryImportPreview.errors.length > 0 && (
                                                <div className="mb-2">
                                                    <div className="fw-bold" style={{ fontSize: 13 }}>Errores principales</div>
                                                    <ul className="mb-0 ps-3" style={{ fontSize: 12 }}>
                                                        {inventoryImportPreview.errors.slice(0, 8).map((err, idx) => (
                                                            <li key={`${err.row ?? 'g'}-${idx}`}>
                                                                {err.row ? `Fila ${err.row}: ` : ''}{err.message}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <div className="table-responsive">
                                                <table className="table table-sm align-middle mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th>Fila</th>
                                                            <th>Producto</th>
                                                            <th>Stock</th>
                                                            <th>Precio</th>
                                                            <th>Estado</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {inventoryImportPreview.items.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={5} className="text-muted">No hay filas de producto para mostrar.</td>
                                                            </tr>
                                                        ) : (
                                                            inventoryImportPreview.items.slice(0, 10).map((item) => (
                                                                <tr key={item.row}>
                                                                    <td>{item.row}</td>
                                                                    <td>
                                                                        <div style={{ fontWeight: 600 }}>{item.nombre || '-'}</div>
                                                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                                                            {item.sku || item.codigo_barras || '-'}
                                                                        </div>
                                                                    </td>
                                                                    <td>{item.stock || '-'}</td>
                                                                    <td>{item.precio || '-'}</td>
                                                                    <td>
                                                                        {item.status === 'OK' ? (
                                                                            <span className="badge bg-success">OK</span>
                                                                        ) : (
                                                                            <span className="badge bg-danger">Error</span>
                                                                        )}
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
                </div>
            ) : tab === 'modulos' ? (
                <div className="table-responsive">
                    <table className="table table-sm align-middle">
                        <thead>
                            <tr>
                                <th style={{ width: 90 }}>ID</th>
                                <th>Módulo</th>
                                <th>Ruta</th>
                                <th style={{ width: 110 }}>Habilitar</th>
                                <th style={{ width: 140 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMods.map(m => {
                                const restricted = isModuleRestrictedByCapability(m);
                                const gate = moduleGateKey(m);
                                const gateLabel = gate ? SAAS_MODULE_GATES[gate]?.label : null;
                                const spec = moduleSpecForModule(m);
                                return (
                                    <tr key={m.id_modulo}>
                                        <td>{m.id_modulo}</td>
                                        <td style={{ fontWeight: 600 }}>
                                            {m.nombre}
                                            {restricted && (
                                                <div className="text-muted" style={{ fontSize: 12, fontWeight: 400 }}>
                                                    Restringido por capacidad SaaS: {gateLabel}
                                                </div>
                                            )}
                                        </td>
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
                                        <td>
                                            <button
                                                type="button"
                                                className="btn btn-outline-primary btn-sm"
                                                disabled={!spec}
                                                onClick={() => {
                                                    if (!spec) return;
                                                    setPermQ('');
                                                    setSelectedModuleKey(spec.key);
                                                }}
                                            >
                                                Ver permisos
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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

            {selectedModule && (
                <>
                    <div className="modal d-block" tabIndex={-1} role="dialog" aria-modal="true">
                        <div className="modal-dialog modal-lg modal-dialog-scrollable">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <div>
                                        <h5 className="modal-title mb-0">Permisos de {selectedModule.label}</h5>
                                        <div className="text-muted" style={{ fontSize: 12 }}>
                                            {moduleStats.enabled}/{moduleStats.total} habilitados
                                            {selectedModuleRestricted ? ' - techo SaaS inactivo' : ''}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        aria-label="Cerrar"
                                        onClick={() => setSelectedModuleKey(null)}
                                    />
                                </div>
                                <div className="modal-body">
                                    {selectedModuleRestricted && (
                                        <div className="alert alert-warning py-2">
                                            <small>
                                                La capacidad SaaS requerida esta inactiva. Puedes guardar restricciones locales, pero el backend validara cualquier alta fuera del techo comercial.
                                            </small>
                                        </div>
                                    )}

                                    {moduleMissingInDb.length > 0 && (
                                        <div className="alert alert-warning py-2">
                                            <small>
                                                Aviso: Hay permisos definidos en el modulo que no existen en la BD:
                                                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                                                    {' '}
                                                    {moduleMissingInDb.join(', ')}
                                                </span>
                                            </small>
                                        </div>
                                    )}

                                    <input
                                        className="form-control form-control-sm mb-3"
                                        placeholder="Filtrar permisos..."
                                        value={permQ}
                                        onChange={(e) => setPermQ(e.target.value)}
                                    />

                                    <div className="table-responsive">
                                        <table className="table table-sm align-middle mb-0">
                                            <thead>
                                                <tr>
                                                    <th>Codigo</th>
                                                    <th>Descripcion</th>
                                                    <th style={{ width: 110 }}>Habilitar</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {modulePermRows.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={3} className="text-muted py-3">
                                                            No hay permisos para mostrar.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    modulePermRows.map(({ code, row }) => {
                                                        const restricted = isPermissionRestrictedByCapability(code);
                                                        const kind = permissionKind(code);
                                                        return (
                                                            <tr key={code}>
                                                                <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
                                                                    <div>{code}</div>
                                                                    <span className={`badge ${kind.className} mt-1`}>
                                                                        {kind.label}
                                                                    </span>
                                                                </td>
                                                                <td style={{ fontSize: 12, opacity: 0.85 }}>
                                                                    {row?.descripcion ?? <span className="text-muted">No existe en BD</span>}
                                                                    {restricted && (
                                                                        <div className="text-muted mt-1">
                                                                            Bloqueado por capacidad SaaS inactiva.
                                                                        </div>
                                                                    )}
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
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setSelectedModuleKey(null)}
                                    >
                                        Cerrar
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={savePerms}
                                        disabled={loading}
                                    >
                                        Guardar permisos
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
