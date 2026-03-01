// src/api/adminClient.ts
import axios, { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store/store';
import type { RootState } from '../store/store';

const API_URL = import.meta.env.VITE_ADMIN_API_URL || 'http://localhost/pos_saas_admin/public';

const adminClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<void> | null = null;
type RetriableRequestConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const isAuthPath = (url?: string) => {
  if (!url) return false;
  const u = url.startsWith('http') ? url : `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  return /\/admin\/auth\/(login|refresh|logout|me)\b/.test(u);
};

// si todavía no implementas refresh en el admin-api, deja esto y luego lo activamos
const doRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/admin/auth/refresh`, {}, { withCredentials: true })
      .then(() => {})
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

adminClient.interceptors.response.use(
  (r: AxiosResponse) => r,
  async (error: AxiosError) => {
    const response = error.response;
    const original = (error.config || {}) as RetriableRequestConfig;

    if (!response) return Promise.reject(error);

    const { adminAuth } = store.getState() as RootState;
    const isAuthenticated = adminAuth?.status === 'authenticated';

    if (
      response.status === 401 &&
      !isAuthPath(original.url || original.baseURL) &&
      !original._retried &&
      isAuthenticated
    ) {
      try {
        original._retried = true;
        await doRefresh(); // si no existe endpoint aún, lo desactivamos
        return await adminClient.request(original);
      } catch {
        // si expira sesión, mandamos a login admin
        window.location.href = '#/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default adminClient;
