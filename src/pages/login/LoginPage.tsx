import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store/store';
import { adminLogin, adminOtpResend, adminOtpVerify } from '../../store/adminAuthSlice';

function errorLabel(value?: string | null): string {
  if (!value) return '';
  const labels: Record<string, string> = {
    INVALID_CREDENTIALS: 'Credenciales invalidas.',
    RATE_LIMITED: 'Demasiados intentos. Espera unos minutos e intenta nuevamente.',
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '42px clamp(18px, 6vw, 90px)',
    backgroundImage:
      'linear-gradient(90deg, rgba(8, 18, 38, 0.28), rgba(8, 18, 38, 0.84) 48%, rgba(8, 18, 38, 0.96)), url("./admin-login-bg.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: '#eef5ff',
  },
  card: {
    width: 'min(100%, 680px)',
    borderRadius: 28,
    padding: '34px clamp(22px, 4vw, 42px)',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'linear-gradient(180deg, rgba(20,31,54,0.92), rgba(11,18,34,0.94))',
    boxShadow: '0 28px 80px rgba(0,0,0,0.38)',
    backdropFilter: 'blur(12px)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 26,
  },
  mark: {
    width: 58,
    height: 58,
    borderRadius: 16,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #3b82f6, #1e3a8a)',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: '0 12px 28px rgba(37,99,235,0.28)',
    color: '#fff',
    fontSize: 28,
    fontWeight: 900,
  },
  eyebrow: {
    margin: 0,
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    margin: '4px 0 0',
    fontSize: 'clamp(28px, 3vw, 36px)',
    fontWeight: 900,
    lineHeight: 1.05,
  },
  subtitle: {
    margin: '8px 0 0',
    color: '#cbd5e1',
    fontSize: 16,
  },
  label: {
    display: 'block',
    marginBottom: 8,
    color: '#dbeafe',
    fontSize: 14,
    fontWeight: 700,
  },
  input: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.58)',
    background: 'rgba(15,23,42,0.68)',
    color: '#f8fafc',
    outline: 'none',
    padding: '0 16px',
    fontSize: 16,
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
  },
  field: {
    marginBottom: 18,
  },
  passwordWrap: {
    display: 'flex',
    alignItems: 'center',
    borderRadius: 14,
    border: '1px solid rgba(148,163,184,0.58)',
    background: 'rgba(15,23,42,0.68)',
    overflow: 'hidden',
  },
  passwordInput: {
    flex: 1,
    height: 54,
    border: 0,
    background: 'transparent',
    color: '#f8fafc',
    outline: 'none',
    padding: '0 16px',
    fontSize: 16,
  },
  eyeButton: {
    width: 56,
    height: 54,
    border: 0,
    display: 'grid',
    placeItems: 'center',
    background: 'transparent',
    color: '#dbeafe',
  },
  primaryButton: {
    minHeight: 54,
    border: 0,
    borderRadius: 14,
    padding: '0 24px',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: '#fff',
    fontWeight: 900,
    fontSize: 16,
    boxShadow: '0 18px 32px rgba(37,99,235,0.28)',
  },
  ghostButton: {
    minHeight: 54,
    borderRadius: 14,
    padding: '0 18px',
    border: '1px solid rgba(191,219,254,0.34)',
    background: 'rgba(255,255,255,0.04)',
    color: '#dbeafe',
    fontWeight: 800,
  },
  actionRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  infoBox: {
    borderRadius: 16,
    border: '1px solid rgba(96,165,250,0.32)',
    background: 'rgba(37,99,235,0.12)',
    color: '#dbeafe',
    padding: '12px 14px',
    fontSize: 14,
    marginBottom: 18,
  },
  alertError: {
    borderRadius: 14,
    border: '1px solid rgba(248,113,113,0.42)',
    background: 'rgba(127,29,29,0.28)',
    color: '#fecaca',
    padding: '11px 14px',
    fontSize: 14,
    marginBottom: 14,
  },
  alertSuccess: {
    borderRadius: 14,
    border: '1px solid rgba(52,211,153,0.38)',
    background: 'rgba(6,95,70,0.25)',
    color: '#bbf7d0',
    padding: '11px 14px',
    fontSize: 14,
    marginBottom: 14,
  },
};

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { status, error, otpRequired, otpEmail, otpTtl } = useSelector((s: RootState) => s.adminAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        window.location.hash = '#/';
      }
      return;
    }

    const res = await dispatch(adminLogin({ email, password }));
    if (adminLogin.fulfilled.match(res) && !res.payload.otp_required) {
      window.location.hash = '#/';
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
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brandRow}>
          <div style={styles.mark}>B</div>
          <div>
            <p style={styles.eyebrow}>Bersano Admin</p>
            <h1 style={styles.title}>{otpRequired ? 'Verificacion OTP' : 'Iniciar sesion'}</h1>
            <p style={styles.subtitle}>
              {otpRequired
                ? 'Confirma el codigo de seguridad enviado a tu correo.'
                : 'Administra empresas, accesos y salud multibase.'}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit}>
          {!otpRequired ? (
            <>
              <div style={styles.field}>
                <label style={styles.label} htmlFor="admin-login-email">
                  Email *
                </label>
                <input
                  id="admin-login-email"
                  style={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@bersanopos.com"
                  autoComplete="username"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="admin-login-password">
                  Contrasena *
                </label>
                <div style={styles.passwordWrap}>
                  <input
                    id="admin-login-password"
                    style={styles.passwordInput}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    style={styles.eyeButton}
                    title="Mostrar contrasena mientras se presiona"
                    aria-label="Mostrar contrasena mientras se presiona"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowPassword(true);
                    }}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                    onTouchCancel={() => setShowPassword(false)}
                  >
                    <EyeIcon />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={styles.infoBox}>
                Enviamos un codigo de 6 digitos a <strong>{maskedEmail}</strong>
                {otpTtl ? `, valido por ${Math.ceil(otpTtl / 60)} minutos.` : '.'}
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="admin-login-otp">
                  Codigo OTP *
                </label>
                <input
                  id="admin-login-otp"
                  style={{
                    ...styles.input,
                    textAlign: 'center',
                    letterSpacing: 8,
                    fontWeight: 900,
                    fontSize: 22,
                  }}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
            </>
          )}

          {error ? <div style={styles.alertError}>{errorLabel(String(error))}</div> : null}

          {resendOk ? <div style={styles.alertSuccess}>Codigo reenviado.</div> : null}

          <div style={styles.actionRow}>
            <button
              style={styles.primaryButton}
              type="submit"
              disabled={loading || (otpRequired && code.length !== 6)}
            >
              {loading ? 'Validando...' : otpRequired ? 'Verificar codigo' : 'Entrar'}
            </button>

            {otpRequired ? (
              <button style={styles.ghostButton} type="button" disabled={loading} onClick={onResend}>
                Reenviar codigo
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}
