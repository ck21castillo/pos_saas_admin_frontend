import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';

import HomeLayout from '../layout/HomeLayout';

const LoginPage = lazy(() => import('../pages/login/LoginPage'));
const AdminDashboardPage = lazy(() => import('../pages/dashboard/AdminDashboardPage'));
const EmpresasPage = lazy(() => import('../pages/empresas/EmpresasPage'));
const EmpresaDetailPage = lazy(() => import('../pages/empresas/EmpresaDetailPage'));
const SaasPlansPage = lazy(() => import('../pages/saas/SaasPlansPage'));
const OnboardingPage = lazy(() => import('../pages/onboarding/OnboardingPage'));
const HelpTicketsPage = lazy(() => import('../pages/help/HelpTicketsPage'));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage'));
const LandingVisitorsPage = lazy(() => import('../pages/analytics/LandingVisitorsPage'));
const TenantHealthPage = lazy(() => import('../pages/analytics/TenantHealthPage'));
const AuditLogPage = lazy(() => import('../pages/analytics/AuditLogPage'));

const RouteLoader: React.FC = () => <div style={{ padding: 16 }}>Cargando...</div>;

const RequireAuth: React.FC = () => {
    const status = useSelector((s: RootState) => s.adminAuth.status);
    if (status === 'checking') return <div style={{ padding: 16 }}>Cargando...</div>;
    return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />;
};

const PublicOnly: React.FC = () => {
    const status = useSelector((s: RootState) => s.adminAuth.status);
    return status === 'authenticated' ? <Navigate to="/dashboard" replace /> : <Outlet />;
};

export default function AppRouter() {
    return (
        <Suspense fallback={<RouteLoader />}>
            <Routes>
                <Route element={<PublicOnly />}>
                    <Route path="/login" element={<LoginPage />} />
                </Route>

                <Route element={<RequireAuth />}>
                    <Route element={<HomeLayout />}>
                        <Route path="/dashboard" element={<AdminDashboardPage />} />
                        <Route path="/empresas" element={<EmpresasPage />} />
                        <Route path="/empresas/:id" element={<EmpresaDetailPage />} />
                        <Route path="/planes-precios" element={<SaasPlansPage />} />
                        <Route path="/onboarding" element={<OnboardingPage />} />
                        <Route path="/ayuda" element={<HelpTicketsPage />} />
                        <Route path="/notificaciones" element={<NotificationsPage />} />
                        <Route path="/analytics/landing" element={<LandingVisitorsPage />} />
                        <Route path="/salud-tenants" element={<TenantHealthPage />} />
                        <Route path="/auditoria" element={<AuditLogPage />} />
                    </Route>
                </Route>

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<div style={{ padding: 16 }}>404</div>} />
            </Routes>
        </Suspense>
    );
}

