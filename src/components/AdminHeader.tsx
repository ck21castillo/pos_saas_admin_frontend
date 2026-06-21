import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store/store';
import { toggleSidebar } from '../store/uiSlice';
import { adminLogout } from '../store/adminAuthSlice';
import MI from './MI';
import '../styles/Header.css';

function displayNameFromEmail(email: string): string {
    const local = email.split('@')[0] || 'admin';
    const first = local.split(/[._-]/).filter(Boolean)[0] || local;
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export default function AdminHeader() {
    const dispatch = useDispatch<AppDispatch>();
    const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
    const adminEmail = useSelector((s: RootState) => s.adminAuth.admin?.email) ?? 'admin@bersanopos.com';

    const [open, setOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);
    const initials = (adminEmail.trim()[0] || 'A').toUpperCase();
    const name = displayNameFromEmail(adminEmail);

    React.useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const onLogout = async () => {
        await dispatch(adminLogout());
        window.location.hash = '#/login';
    };

    return (
        <header className="header-container">
            <button
                className="header-burger"
                aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
                title={collapsed ? 'Expandir menu' : 'Colapsar menu'}
                onClick={() => dispatch(toggleSidebar())}
            >
                <MI name={collapsed ? 'menu_open' : 'menu'} />
            </button>

            <h1 className="header-user-name">Hola, {name}</h1>

            <div className="header-user" ref={ref}>
                <button className="header-user-btn" onClick={() => setOpen(v => !v)}>
                    <span className="header-avatar">{initials}</span>
                    <span className="header-user-email">{adminEmail}</span>
                    <MI name="expand_more" />
                </button>

                {open && (
                    <div className="header-menu" role="menu">
                        <div className="header-menu-email">{adminEmail}</div>
                        <button className="header-menu-item" onClick={onLogout}>
                            <MI name="logout" /> Cerrar sesion
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}
