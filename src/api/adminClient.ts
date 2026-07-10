// src/api/adminClient.ts
import axios, { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import { store } from '../store/store';
import type { RootState } from '../store/store';
import { requestAdminReauth } from './adminSessionEvents';

const API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost/pos_saas_admin/public';
const REQUEST_TIMEOUT_MS = 15000;

const adminClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

const isAuthPath = (url?: string) => {
  if (!url) return false;
  const u = url.startsWith('http') ? url : `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  return /\/admin\/auth\/(login|logout|me|reauth|otp\/verify|otp\/resend)\b/.test(u);
};

adminClient.interceptors.response.use(
  (r: AxiosResponse) => r,
  async (error: AxiosError) => {
    const response = error.response;
    const originalConfig = error.config as (typeof error.config & { _adminReauthRetry?: boolean }) | undefined;
    const originalUrl = originalConfig?.url || originalConfig?.baseURL;

    if (!response) return Promise.reject(error);

    const { adminAuth } = store.getState() as RootState;
    const isAuthenticated = adminAuth?.status === 'authenticated';

    if (
      response.status === 401
      && !isAuthPath(originalUrl)
      && isAuthenticated
      && originalConfig
      && !originalConfig._adminReauthRetry
    ) {
      const renewed = await requestAdminReauth();
      if (renewed) {
        originalConfig._adminReauthRetry = true;
        return adminClient(originalConfig);
      }

      store.dispatch({ type: 'adminAuth/adminSessionCleared' });
      window.location.href = '#/login';
    }

    return Promise.reject(error);
  }
);

export default adminClient;
