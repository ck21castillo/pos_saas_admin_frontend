import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { adminLogin } from '../../store/adminAuthSlice';

export default function LoginPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { status, error } = useSelector((s: RootState) => s.adminAuth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const loading = status === 'checking';

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await dispatch(adminLogin({ email, password }));
        if (adminLogin.fulfilled.match(res)) {
            window.location.hash = '#/empresas';
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                padding: 18,
                background:
                    'radial-gradient(1200px 600px at 100% -20%, #8e9ffa33 0%, transparent 60%),' +
                    'radial-gradient(1000px 600px at -10% 110%, #a1f2d633 0%, transparent 55%),' +
                    'linear-gradient(135deg, #0f1221, #151a30 60%, #171b2d)',
                color: '#eaf0ff',
            }}
        >
            <div
                style={{
                    width: '100%',
                    maxWidth: 420,
                    borderRadius: 18,
                    padding: 22,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                }}
            >
                <h3 style={{ margin: 0, fontWeight: 800 }}>BERSANO ADMIN</h3>
                <div style={{ opacity: 0.75, marginBottom: 12, fontSize: 13 }}>
                    Inicia sesión para administrar empresas y accesos
                </div>

                <form onSubmit={onSubmit}>
                    <div className="mb-2">
                        <label style={{ fontSize: 12, opacity: 0.85 }}>Email</label>
                        <input
                            className="form-control"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@..."
                        />
                    </div>

                    <div className="mb-2">
                        <label style={{ fontSize: 12, opacity: 0.85 }}>Password</label>
                        <input
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            type="password"
                        />
                    </div>

                    {error ? (
                        <div className="alert alert-danger py-2" style={{ fontSize: 13 }}>
                            {String(error)}
                        </div>
                    ) : null}

                    <button className="btn btn-primary w-100" type="submit" disabled={loading}>
                        {loading ? 'Entrando…' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    );
}
