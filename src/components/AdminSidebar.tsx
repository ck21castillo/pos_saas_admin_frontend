import { NavLink } from 'react-router-dom';
import MI from './MI';
import '../styles/Sidebar.css';

export default function AdminSidebar() {
    return (
        <aside className="sidebar-container">
            <div className="sidebar-elements">
                <div className="sidebar-brand">
                    BERSANO <span className="accent">ADMIN</span>
                </div>

                <ul className="sidebar-nav">
                    <li>
                        <NavLink to="/empresas" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <MI name="business" />
                            <span className="label">Empresas</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/onboarding" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <MI name="how_to_reg" />
                            <span className="label">Onboarding</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/ayuda" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <MI name="help" />
                            <span className="label">Ayuda</span>
                        </NavLink>
                    </li>
                    <li>
                        <NavLink to="/notificaciones" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            <MI name="notifications" />
                            <span className="label">Notificaciones</span>
                        </NavLink>
                    </li>

                </ul>

                <div className="sidebar-footer">
                    v1 — control de empresas / módulos / permisos
                </div>
            </div>
        </aside>
    );
}
