import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';

import HomeLayout from '../layout/HomeLayout';

const LoginPage = lazy(() => import('../pages/login/LoginPage'));
const EmpresasPage = lazy(() => import('../pages/empresas/EmpresasPage'));
const EmpresaDetailPage = lazy(() => import('../pages/empresas/EmpresaDetailPage'));
const OnboardingPage = lazy(() => import('../pages/onboarding/OnboardingPage'));
const HelpTicketsPage = lazy(() => import('../pages/help/HelpTicketsPage'));
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage'));

const RouteLoader: React.FC = () => <div style={{ padding: 16 }}>Cargando...</div>;

const RequireAuth: React.FC = () => {
    const status = useSelector((s: RootState) => s.adminAuth.status);
    if (status === 'checking') return <div style={{ padding: 16 }}>Cargando…</div>;
    return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />;
};

const PublicOnly: React.FC = () => {
    const status = useSelector((s: RootState) => s.adminAuth.status);
    return status === 'authenticated' ? <Navigate to="/empresas" replace /> : <Outlet />;
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
                        <Route path="/empresas" element={<EmpresasPage />} />
                        <Route path="/empresas/:id" element={<EmpresaDetailPage />} />
                        <Route path="/onboarding" element={<OnboardingPage />} />
                        <Route path="/ayuda" element={<HelpTicketsPage />} />
                        <Route path="/notificaciones" element={<NotificationsPage />} />
                    </Route>
                </Route>

                <Route path="/" element={<Navigate to="/empresas" replace />} />
                <Route path="*" element={<div style={{ padding: 16 }}>404</div>} />
            </Routes>
        </Suspense>
    );
}
