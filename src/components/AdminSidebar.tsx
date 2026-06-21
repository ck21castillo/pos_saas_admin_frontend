import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import MI from './MI';
import '../styles/Sidebar.css';

const menuItems = [
    { to: '/dashboard', icon: 'space_dashboard', label: 'Inicio' },
    { to: '/empresas', icon: 'business', label: 'Empresas' },
    { to: '/onboarding', icon: 'how_to_reg', label: 'Onboarding' },
    { to: '/ayuda', icon: 'help', label: 'Ayuda' },
    { to: '/notificaciones', icon: 'notifications', label: 'Notificaciones' },
    { to: '/analytics/landing', icon: 'monitoring', label: 'Visitantes' },
    { to: '/salud-tenants', icon: 'database', label: 'Salud multibase' },
    { to: '/auditoria', icon: 'manage_history', label: 'Auditoria' },
];

export default function AdminSidebar() {
    const adminEmail = useSelector((s: RootState) => s.adminAuth.admin?.email) ?? 'admin@bersanopos.com';
    const initial = (adminEmail.trim()[0] || 'A').toUpperCase();

    return (
        <aside className="sidebar-container">
            <div className="sidebar-elements">
                <NavLink to="/dashboard" className="sidebar-brand" aria-label="Ir a inicio" title="Ir a inicio">
                    <div className="sidebar-brand-mark" aria-hidden>B</div>
                    <div className="sidebar-brand-copy">
                        <div className="sidebar-brand-title">BERSANO</div>
                        <div className="sidebar-brand-subtitle">Panel administrativo</div>
                    </div>
                </NavLink>

                <ul className="sidebar-nav">
                    {menuItems.map((item) => (
                        <li key={item.to}>
                            <NavLink to={item.to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                                <MI name={item.icon} />
                                <span className="label">{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>

                <div className="sidebar-user-card">
                    <div className="sidebar-user-box" title={adminEmail}>
                        <div className="sidebar-user-avatar" aria-hidden>{initial}</div>
                        <div className="sidebar-user-copy">
                            <div className="sidebar-user-name">Super admin</div>
                            <div className="sidebar-user-email">{adminEmail}</div>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
