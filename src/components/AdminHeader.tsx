import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store/store';
import { toggleSidebar } from '../store/uiSlice';
import { adminLogout } from '../store/adminAuthSlice';
import MI from './MI';
import '../styles/Header.css';

export default function AdminHeader() {
    const dispatch = useDispatch<AppDispatch>();
    const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
    const adminEmail = useSelector((s: RootState) => s.adminAuth.admin?.email) ?? 'admin';

    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const initials = (adminEmail?.trim()?.[0] ?? 'A').toUpperCase();

    const onLogout = async () => {
        await dispatch(adminLogout());
        // con HashRouter:
        window.location.hash = '#/login';
    };

    return (
        <header className="header-container">
            <button
                className="header-burger"
                aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
                onClick={() => dispatch(toggleSidebar())}
            >
                <MI name={collapsed ? 'menu_open' : 'menu'} />
            </button>

            <div className="header-title">Panel Administrativo — BersanoPOS</div>

            <div className="header-right" ref={ref}>
                <button className="header-user-btn" onClick={() => setOpen(v => !v)}>
                    <span className="header-avatar">{initials}</span>
                    <span style={{ fontSize: 13, opacity: 0.9 }}>{adminEmail}</span>
                    <MI name="expand_more" />
                </button>

                {open && (
                    <div className="header-menu" role="menu">
                        <button onClick={onLogout}>
                            <MI name="logout" /> Cerrar sesión
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
