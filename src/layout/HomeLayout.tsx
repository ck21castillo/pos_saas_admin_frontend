import { useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import AdminHeader from '../components/AdminHeader';
import AdminSidebar from '../components/AdminSidebar';
import '../styles/HomeLayout.css';

export default function HomeLayout() {
    const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
    const theme = useSelector((s: RootState) => s.ui.theme);

    useLayoutEffect(() => {
        if (collapsed) document.body.classList.add('has-collapsed');
        else document.body.classList.remove('has-collapsed');
        return () => document.body.classList.remove('has-collapsed');
    }, [collapsed]);

    useLayoutEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <>
            <AdminHeader />
            <div className="app-body">
                <AdminSidebar />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </>
    );
}
