import adminClient from './adminClient';

export type SaasCiclo = 'MENSUAL' | 'ANUAL';
export type SaasEstado = 'PRUEBA' | 'ACTIVA' | 'POR_VENCER' | 'VENCIDA' | 'SUSPENDIDA';
export type SaasManagedCapabilityCode =
  | 'SOPORTE_TECNICO'
  | 'PRECONTABILIDAD'
  | 'EXPORTACION_CONTABLE'
  | 'FACTURACION_ELECTRONICA'
  | 'NOTAS_FISCALES';

export const SAAS_MANAGED_CAPABILITY_ORDER: SaasManagedCapabilityCode[] = [
  'SOPORTE_TECNICO',
  'PRECONTABILIDAD',
  'EXPORTACION_CONTABLE',
  'FACTURACION_ELECTRONICA',
  'NOTAS_FISCALES',
];

export function orderSaasCapabilities<T extends { codigo_capacidad: SaasManagedCapabilityCode }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) => {
      const leftIndex = SAAS_MANAGED_CAPABILITY_ORDER.indexOf(left.codigo_capacidad);
      const rightIndex = SAAS_MANAGED_CAPABILITY_ORDER.indexOf(right.codigo_capacidad);
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }
  );
}

export type SaasPlanCapability = {
  codigo_capacidad: SaasManagedCapabilityCode;
  nombre: string;
  descripcion?: string | null;
  incluida: boolean;
};

export type SaasEffectiveCapability = {
  codigo_capacidad: SaasManagedCapabilityCode;
  nombre: string;
  descripcion?: string | null;
  incluido_en_plan?: boolean;
  plan_incluida: boolean;
  efectiva: boolean;
  origen: 'PLAN' | 'EXCEPCION_ADMINISTRATIVA' | 'EXCEPCION_ADMIN' | 'PLAN_SIN_SUSCRIPCION' | 'SIN_SUSCRIPCION' | string;
  puede_configurar_localmente?: boolean;
  diagnostico_bloqueo?: SaasCapabilityBlockDiagnostic | null;
  excepcion?: {
    enabled: boolean;
    motivo: string;
    updated_at?: string | null;
  } | null;
};

export type SaasCapabilityBlockDiagnostic = {
  codigo?: string | null;
  mensaje?: string | null;
  message?: string | null;
  cantidad_ordenes_abiertas?: number | null;
  ordenes_abiertas?: number | null;
  total_ordenes_abiertas?: number | null;
  por_estado?: Record<string, number> | Array<{ estado?: string | null; cantidad?: number | null; total?: number | null }>;
  estados?: Record<string, number> | Array<{ estado?: string | null; cantidad?: number | null; total?: number | null }>;
  muestra_ordenes?: SaasCapabilityBlockedOrder[];
  muestra?: SaasCapabilityBlockedOrder[];
  ordenes?: SaasCapabilityBlockedOrder[];
  sample?: SaasCapabilityBlockedOrder[];
  [key: string]: unknown;
};

export type SaasCapabilityBlockedOrder = {
  id_orden?: number | string | null;
  id?: number | string | null;
  numero?: number | string | null;
  codigo?: string | null;
  estado?: string | null;
  cliente?: string | null;
  descripcion?: string | null;
  fecha?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type SyncStatus = {
  estado: 'SINCRONIZADO' | 'PENDIENTE' | string;
  id_empresa?: number;
  intentos?: number;
  proximo_intento_at?: string | null;
  sincronizado_at?: string | null;
};

export type SyncResult = SyncStatus | {
  estado: 'SINCRONIZADO' | 'PENDIENTE' | string;
  items?: SyncStatus[];
};

export type CapabilityExceptionPayload =
  | {
      enabled: boolean;
      motivo: string;
    }
  | {
      restablecer_plan: true;
      motivo: string;
    };

export function isSyncPending(sync?: SyncResult | null): boolean {
  if (!sync) return false;
  const estado = String(sync.estado ?? '').toUpperCase();
  if (estado === 'PENDIENTE') return true;
  if ('items' in sync && Array.isArray(sync.items)) {
    return sync.items.some((item) => String(item.estado ?? '').toUpperCase() === 'PENDIENTE');
  }
  return false;
}

export type SaasPlan = {
  id_plan: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precio_mensual: number;
  precio_anual: number;
  usuarios_incluidos: number;
  precio_usuario_extra_mensual: number;
  precio_usuario_extra_anual: number;
  whatsapp_incluido: boolean;
  visible_publico: boolean;
  precio_whatsapp_mensual: number;
  precio_whatsapp_anual: number;
  activo: boolean;
  orden: number;
  landing_titulo?: string | null;
  landing_resumen?: string | null;
  landing_icono?: string | null;
  landing_destacado?: boolean;
  landing_etiqueta?: string | null;
  landing_cta_texto?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SaasPlanPublicBenefit = {
  id_beneficio?: number;
  codigo_capacidad?: string | null;
  titulo: string;
  descripcion?: string | null;
  icono?: string | null;
  incluido: boolean;
  orden: number;
};

export type SaveSaasPlanPublicProfilePayload = {
  landing_titulo?: string | null;
  landing_resumen?: string | null;
  landing_icono: string;
  landing_destacado: boolean;
  landing_etiqueta?: string | null;
  landing_cta_texto: string;
  beneficios: SaasPlanPublicBenefit[];
};

export type SaasPlanPublicProfileResponse = {
  ok: boolean;
  plan: SaasPlan;
  beneficios: SaasPlanPublicBenefit[];
};

export type SaasCanalPago = {
  id_canal: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  orden: number;
};

export type SaasSubscription = {
  id_empresa: number;
  id_suscripcion?: number | null;
  id_plan?: number | null;
  estado?: SaasEstado | string | null;
  ciclo?: SaasCiclo | string | null;
  plan_codigo?: string | null;
  plan_nombre?: string | null;
  empresa_estado?: number | null;
  prueba_inicio?: string | null;
  prueba_fin?: string | null;
  periodo_inicio?: string | null;
  periodo_fin?: string | null;
  proximo_pago_fecha?: string | null;
  gracia_hasta?: string | null;
  dias_para_vencer?: number | null;
  dias_para_pago?: number | null;
  dias_gracia_restantes?: number | null;
  en_gracia?: boolean;
  usuarios_incluidos?: number | null;
  usuarios_extra?: number | null;
  whatsapp_activo?: boolean;
  valor_plan?: number | null;
  valor_usuario_extra?: number | null;
  valor_whatsapp?: number | null;
  descuento_periodo?: number | null;
  total_periodo?: number | null;
  ultimo_pago_fecha?: string | null;
  ultimo_pago_total?: number | null;
  suspendida_en?: string | null;
  suspendida_motivo?: string | null;
  notas?: string | null;
};

export type SaasPayment = {
  id_pago: number;
  id_empresa: number;
  id_plan?: number | null;
  plan_codigo?: string | null;
  plan_nombre?: string | null;
  ciclo: SaasCiclo | string;
  periodo_inicio: string;
  periodo_fin: string;
  fecha_pago: string;
  valor_pagado: number;
  canal_pago: string;
  referencia?: string | null;
  observaciones?: string | null;
  registrado_por_email?: string | null;
  created_at?: string | null;
};

export type CompanySubscriptionResponse = {
  ok: boolean;
  empresa: {
    id_empresa: number;
    nombre: string;
    codigo?: string | null;
    estado?: number | null;
    db_name?: string | null;
    tenant_estado?: string | null;
  };
  suscripcion: SaasSubscription | null;
  pagos_recientes: SaasPayment[];
  planes: SaasPlan[];
  canales_pago: SaasCanalPago[];
  capacidades_efectivas: SaasEffectiveCapability[];
};

export type SaveSaasPlanPayload = {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precio_mensual: number;
  precio_anual: number;
  usuarios_incluidos: number;
  precio_usuario_extra_mensual: number;
  precio_usuario_extra_anual: number;
  whatsapp_incluido: boolean;
  visible_publico: boolean;
  precio_whatsapp_mensual: number;
  precio_whatsapp_anual: number;
  activo: boolean;
  orden: number;
};

export async function listarPlanesSaas(active = false) {
  const { data } = await adminClient.get('/admin/saas/planes', {
    params: active ? { active: 1 } : undefined,
  });
  return data as { ok: boolean; items: SaasPlan[] };
}

export async function crearPlanSaas(payload: SaveSaasPlanPayload) {
  const { data } = await adminClient.post('/admin/saas/planes', payload);
  return data as { ok: boolean; item: SaasPlan };
}

export async function actualizarPlanSaas(idPlan: number, payload: SaveSaasPlanPayload) {
  const { data } = await adminClient.put(`/admin/saas/planes/${idPlan}`, payload);
  return data as { ok: boolean; item: SaasPlan };
}

export async function getPlanPublicProfile(idPlan: number) {
  const { data } = await adminClient.get(`/admin/saas/planes/${idPlan}/publico`);
  return data as SaasPlanPublicProfileResponse;
}

export async function savePlanPublicProfile(idPlan: number, payload: SaveSaasPlanPublicProfilePayload) {
  const { data } = await adminClient.put(`/admin/saas/planes/${idPlan}/publico`, payload);
  return data as SaasPlanPublicProfileResponse;
}

export async function getPlanCapabilities(idPlan: number) {
  const { data } = await adminClient.get(`/admin/saas/planes/${idPlan}/capacidades`);
  return data as { ok: boolean; items: SaasPlanCapability[] };
}

export async function savePlanCapabilities(
  idPlan: number,
  capacidades: Record<SaasManagedCapabilityCode, boolean>
) {
  const { data } = await adminClient.put(`/admin/saas/planes/${idPlan}/capacidades`, { capacidades });
  return data as { ok: boolean; items: SaasPlanCapability[]; empresas_actualizadas: number[]; sync?: SyncResult };
}
export type SaveSubscriptionPayload = {
  id_plan: number;
  estado: SaasEstado | string;
  ciclo: SaasCiclo | string;
  periodo_inicio?: string | null;
  periodo_fin?: string | null;
  proximo_pago_fecha?: string | null;
  gracia_hasta?: string | null;
  prueba_inicio?: string | null;
  prueba_fin?: string | null;
  usuarios_incluidos: number;
  usuarios_extra: number;
  whatsapp_activo: boolean;
  descuento_periodo: number;
  notas?: string | null;
};

export type RegisterPaymentPayload = {
  id_plan: number;
  ciclo: SaasCiclo | string;
  fecha_pago: string;
  periodo_inicio: string;
  periodo_fin?: string | null;
  valor_pagado: number;
  canal_pago: string;
  referencia?: string | null;
  observaciones?: string | null;
  usuarios_incluidos: number;
  usuarios_extra: number;
  whatsapp_activo: boolean;
  descuento_periodo?: number;
};

export async function getEmpresaSuscripcion(idEmpresa: number) {
  const { data } = await adminClient.get(`/admin/empresas/${idEmpresa}/suscripcion`);
  return data as CompanySubscriptionResponse;
}

export async function saveEmpresaSuscripcion(idEmpresa: number, payload: SaveSubscriptionPayload) {
  const { data } = await adminClient.put(`/admin/empresas/${idEmpresa}/suscripcion`, payload);
  return data as { ok: boolean; item: SaasSubscription; capacidades_efectivas: SaasEffectiveCapability[]; sync?: SyncResult };
}

export async function saveEmpresaCapabilityException(
  idEmpresa: number,
  codigo: SaasManagedCapabilityCode,
  payload: CapabilityExceptionPayload
) {
  const { data } = await adminClient.put(
    `/admin/empresas/${idEmpresa}/suscripcion/capacidades/${codigo}`,
    payload
  );
  return data as { ok: boolean; capacidades_efectivas: SaasEffectiveCapability[]; sync?: SyncResult };
}

export async function registrarPagoSuscripcion(idEmpresa: number, payload: RegisterPaymentPayload) {
  const { data } = await adminClient.post(`/admin/empresas/${idEmpresa}/suscripcion/pagos`, payload);
  return data as { ok: boolean; suscripcion: SaasSubscription; pago: SaasPayment; sync?: SyncResult };
}

export async function suspenderEmpresaSuscripcion(idEmpresa: number, motivo: string) {
  const { data } = await adminClient.patch(`/admin/empresas/${idEmpresa}/suscripcion/suspender`, { motivo });
  return data as { ok: boolean; item: SaasSubscription; sync?: SyncResult };
}

export async function reactivarEmpresaSuscripcion(idEmpresa: number) {
  const { data } = await adminClient.patch(`/admin/empresas/${idEmpresa}/suscripcion/reactivar`);
  return data as { ok: boolean; item: SaasSubscription; sync?: SyncResult };
}

export async function extenderPruebaSuscripcion(idEmpresa: number, dias: number) {
  const { data } = await adminClient.post(`/admin/empresas/${idEmpresa}/suscripcion/extender-prueba`, { dias });
  return data as { ok: boolean; item: SaasSubscription; sync?: SyncResult };
}

