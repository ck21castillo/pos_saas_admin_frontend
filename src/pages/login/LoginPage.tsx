import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { adminLogin, adminOtpResend, adminOtpVerify } from '../../store/adminAuthSlice';

function errorLabel(value?: string | null): string {
    if (!value) return '';
    const labels: Record<string, string> = {
        INVALID_CREDENTIALS: 'Credenciales invalidas.',
        OTP_REQUIRED: 'Ingresa el codigo enviado a tu correo.',
        OTP_INVALID: 'Codigo incorrecto.',
        OTP_EXPIRED: 'El codigo vencio. Inicia sesion nuevamente.',
        OTP_TOO_MANY_ATTEMPTS: 'Demasiados intentos. Inicia sesion nuevamente.',
        OTP_RESEND_LIMIT: 'Limite de reenvios alcanzado. Inicia sesion nuevamente.',
        OTP_SEND_FAILED: 'No se pudo enviar el codigo. Revisa la configuracion SMTP.',
        OTP_INTENT_NOT_FOUND: 'No hay una verificacion activa. Inicia sesion nuevamente.',
    };
    return labels[value] ?? value;
}

export default function LoginPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { status, error, otpRequired, otpEmail, otpTtl } = useSelector((s: RootState) => s.adminAuth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [resendOk, setResendOk] = useState(false);

    const loading = status === 'checking';
    const maskedEmail = useMemo(() => otpEmail || email, [email, otpEmail]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setResendOk(false);

        if (otpRequired) {
            const res = await dispatch(adminOtpVerify({ code }));
            if (adminOtpVerify.fulfilled.match(res)) {
                window.location.hash = '#/empresas';
            }
            return;
        }

        const res = await dispatch(adminLogin({ email, password }));
        if (adminLogin.fulfilled.match(res) && !res.payload.otp_required) {
            window.location.hash = '#/empresas';
        }
    };

    const onResend = async () => {
        setResendOk(false);
        const res = await dispatch(adminOtpResend());
        if (adminOtpResend.fulfilled.match(res)) {
            setCode('');
            setResendOk(true);
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
                    {otpRequired
                        ? 'Verifica el codigo de seguridad enviado a tu correo'
                        : 'Inicia sesion para administrar empresas y accesos'}
                </div>

                <form onSubmit={onSubmit}>
                    {!otpRequired ? (
                        <>
                            <div className="mb-2">
                                <label style={{ fontSize: 12, opacity: 0.85 }}>Email</label>
                                <input
                                    className="form-control"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@..."
                                    autoComplete="username"
                                />
                            </div>

                            <div className="mb-2">
                                <label style={{ fontSize: 12, opacity: 0.85 }}>Password</label>
                                <input
                                    className="form-control"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="********"
                                    type="password"
                                    autoComplete="current-password"
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="alert alert-info py-2" style={{ fontSize: 13 }}>
                                Enviamos un codigo de 6 digitos a <strong>{maskedEmail}</strong>
                                {otpTtl ? `, valido por ${Math.ceil(otpTtl / 60)} minutos.` : '.'}
                            </div>

                            <div className="mb-2">
                                <label style={{ fontSize: 12, opacity: 0.85 }}>Codigo OTP</label>
                                <input
                                    className="form-control text-center"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    style={{ letterSpacing: 6, fontWeight: 800 }}
                                />
                            </div>
                        </>
                    )}

                    {error ? (
                        <div className="alert alert-danger py-2" style={{ fontSize: 13 }}>
                            {errorLabel(String(error))}
                        </div>
                    ) : null}

                    {resendOk ? (
                        <div className="alert alert-success py-2" style={{ fontSize: 13 }}>
                            Codigo reenviado.
                        </div>
                    ) : null}

                    <button className="btn btn-primary w-100" type="submit" disabled={loading || (otpRequired && code.length !== 6)}>
                        {loading ? 'Validando...' : otpRequired ? 'Verificar codigo' : 'Entrar'}
                    </button>

                    {otpRequired ? (
                        <button
                            className="btn btn-link w-100 mt-2 text-light"
                            type="button"
                            disabled={loading}
                            onClick={onResend}
                        >
                            Reenviar codigo
                        </button>
                    ) : null}
                </form>
            </div>
        </div>
    );
}