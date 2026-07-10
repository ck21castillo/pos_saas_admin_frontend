import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import Swal from 'sweetalert2';
import adminClient from '../api/adminClient';
import {
  ADMIN_REAUTH_REQUIRED_EVENT,
  type AdminReauthRequiredDetail,
} from '../api/adminSessionEvents';
import { adminMe, adminSessionCleared } from '../store/adminAuthSlice';
import type { AppDispatch } from '../store/store';

type ApiErrorLike = {
  message?: string;
  response?: {
    data?: {
      error?: string;
      message?: string;
      retry_after?: number;
    };
  };
};

function getReauthError(error: unknown): string {
  const e = (error ?? {}) as ApiErrorLike;
  const code = e.response?.data?.error || e.response?.data?.message || e.message;
  const retryAfter = Number(e.response?.data?.retry_after || 0);

  if (code === 'RATE_LIMITED') {
    return retryAfter > 0
      ? `Demasiados intentos. Intenta de nuevo en ${retryAfter} segundos.`
      : 'Demasiados intentos. Intenta de nuevo mas tarde.';
  }

  if (code === 'INVALID_CREDENTIALS') {
    return 'La contrase\u00f1a no es correcta.';
  }

  if (code === 'REAUTH_EXPIRED' || code === 'INVALID_REAUTH_SESSION') {
    return 'La sesion ya no se puede renovar. Inicia sesion de nuevo.';
  }

  return 'No se pudo renovar la sesion. Intenta de nuevo.';
}

const eyeIcon = `
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

export default function AdminReauthModal() {
  const dispatch = useDispatch<AppDispatch>();
  const openRef = useRef(false);

  useEffect(() => {
    const handleReauthRequired = async (event: Event) => {
      const detail = (event as CustomEvent<AdminReauthRequiredDetail>).detail;
      if (!detail?.resolve || openRef.current) return;

      openRef.current = true;

      const result = await Swal.fire({
        title: 'Sesion vencida',
        html: `
          <div style="text-align:left;max-width:520px;margin:0 auto">
            <p style="margin:0 0 18px;color:#4b5563;font-size:18px;line-height:1.35">
              Ingresa tu contrase&ntilde;a para continuar con la sesion.
            </p>
            <label for="admin-reauth-password" style="display:block;font-weight:700;margin-bottom:8px;color:#374151">
              Contrase&ntilde;a
            </label>
            <div style="display:flex;gap:8px;align-items:center">
              <input
                id="admin-reauth-password"
                type="password"
                autocomplete="current-password"
                class="swal2-input"
                style="flex:1;margin:0;height:48px;border-radius:10px"
              />
              <button
                id="admin-reauth-eye"
                type="button"
                title="Mostrar contrase&ntilde;a mientras se presiona"
                aria-label="Mostrar contrase&ntilde;a mientras se presiona"
                style="height:48px;width:52px;display:flex;align-items:center;justify-content:center;border:1px solid #94a3b8;border-radius:10px;background:white;color:#0f172a"
              >
                ${eyeIcon}
              </button>
            </div>
          </div>
        `,
        icon: 'warning',
        backdrop: 'rgba(15, 23, 42, 0.55)',
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cerrar sesion',
        showCancelButton: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        stopKeydownPropagation: true,
        heightAuto: false,
        reverseButtons: true,
        focusConfirm: false,
        customClass: {
          popup: 'admin-reauth-popup',
          confirmButton: 'admin-reauth-confirm',
          cancelButton: 'admin-reauth-cancel',
        },
        didOpen: () => {
          const container = Swal.getContainer();
          const popup = Swal.getPopup();
          const input = document.getElementById('admin-reauth-password') as HTMLInputElement | null;
          const eye = document.getElementById('admin-reauth-eye') as HTMLButtonElement | null;

          if (container) {
            container.style.zIndex = '99999';
            container.style.pointerEvents = 'auto';
          }

          if (popup) {
            popup.style.borderRadius = '18px';
            popup.style.padding = '34px 36px 30px';
          }

          input?.focus();

          const show = () => {
            if (input) input.type = 'text';
          };
          const hide = () => {
            if (input) input.type = 'password';
          };

          eye?.addEventListener('mousedown', show);
          eye?.addEventListener('mouseup', hide);
          eye?.addEventListener('mouseleave', hide);
          eye?.addEventListener('touchstart', show);
          eye?.addEventListener('touchend', hide);
          eye?.addEventListener('touchcancel', hide);
        },
        preConfirm: async () => {
          const input = document.getElementById('admin-reauth-password') as HTMLInputElement | null;
          const password = input?.value ?? '';

          if (!password) {
            Swal.showValidationMessage('Escribe tu contrase\u00f1a.');
            return false;
          }

          try {
            await adminClient.post('/admin/auth/reauth', { password });
            return true;
          } catch (error) {
            Swal.showValidationMessage(getReauthError(error));
            return false;
          }
        },
      });

      openRef.current = false;

      if (result.isConfirmed) {
        void dispatch(adminMe());
        detail.resolve(true);
        return;
      }

      try {
        await adminClient.post('/admin/auth/logout', {});
      } catch {
        // Si el cierre de sesion remoto falla, limpiamos estado local igualmente.
      }

      dispatch(adminSessionCleared());
      detail.resolve(false);
    };

    window.addEventListener(ADMIN_REAUTH_REQUIRED_EVENT, handleReauthRequired);

    return () => {
      window.removeEventListener(ADMIN_REAUTH_REQUIRED_EVENT, handleReauthRequired);
    };
  }, [dispatch]);

  return null;
}
