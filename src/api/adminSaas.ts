import adminClient from './adminClient';

export type SaasCiclo = 'MENSUAL' | 'ANUAL';
export type SaasEstado = 'PRUEBA' | 'ACTIVA' | 'POR_VENCER' | 'VENCIDA' | 'SUSPENDIDA';

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
  created_at?: string | null;
  updated_at?: string | null;
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
  return data as { ok: boolean; item: SaasSubscription };
}

export async function registrarPagoSuscripcion(idEmpresa: number, payload: RegisterPaymentPayload) {
  const { data } = await adminClient.post(`/admin/empresas/${idEmpresa}/suscripcion/pagos`, payload);
  return data as { ok: boolean; suscripcion: SaasSubscription; pago: SaasPayment };
}

export async function suspenderEmpresaSuscripcion(idEmpresa: number, motivo: string) {
  const { data } = await adminClient.patch(`/admin/empresas/${idEmpresa}/suscripcion/suspender`, { motivo });
  return data as { ok: boolean; item: SaasSubscription };
}

export async function reactivarEmpresaSuscripcion(idEmpresa: number) {
  const { data } = await adminClient.patch(`/admin/empresas/${idEmpresa}/suscripcion/reactivar`);
  return data as { ok: boolean; item: SaasSubscription };
}

export async function extenderPruebaSuscripcion(idEmpresa: number, dias: number) {
  const { data } = await adminClient.post(`/admin/empresas/${idEmpresa}/suscripcion/extender-prueba`, { dias });
  return data as { ok: boolean; item: SaasSubscription };
}

