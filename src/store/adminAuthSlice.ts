import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminClient from '../api/adminClient';

type AdminUser = { id: number; email: string };

type AdminLoginResponse = {
  ok: boolean;
  admin?: AdminUser;
  message?: string;
  otp_required?: boolean;
  email?: string;
  ttl?: number;
};

type State = {
  status: 'checking' | 'authenticated' | 'not-authenticated';
  admin: AdminUser | null;
  error?: string | null;
  otpRequired: boolean;
  otpEmail?: string | null;
  otpTtl?: number | null;
};

const initialState: State = {
  status: 'checking',
  admin: null,
  error: null,
  otpRequired: false,
  otpEmail: null,
  otpTtl: null,
};

type ApiErrorLike = {
  message?: string;
  response?: {
    data?: {
      error?: string;
      message?: string;
    };
  };
};

function getApiError(error: unknown, fallback: string): string {
  const e = (error ?? {}) as ApiErrorLike;
  return e.response?.data?.message || e.response?.data?.error || e.message || fallback;
}

export const adminMe = createAsyncThunk('adminAuth/me', async () => {
  const { data } = await adminClient.get('/admin/auth/me');
  return data as { ok: boolean; admin: AdminUser };
});

export const adminLogin = createAsyncThunk<
  AdminLoginResponse,
  { email: string; password: string },
  { rejectValue: string }
>(
  'adminAuth/login',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminClient.post('/admin/auth/login', payload);
      return data as AdminLoginResponse;
    } catch (error: unknown) {
      return rejectWithValue(getApiError(error, 'LOGIN_FAILED'));
    }
  }
);

export const adminOtpVerify = createAsyncThunk<
  { ok: boolean; admin: AdminUser; message?: string },
  { code: string },
  { rejectValue: string }
>(
  'adminAuth/otpVerify',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminClient.post('/admin/auth/otp/verify', payload);
      return data as { ok: boolean; admin: AdminUser; message?: string };
    } catch (error: unknown) {
      return rejectWithValue(getApiError(error, 'OTP_FAILED'));
    }
  }
);

export const adminOtpResend = createAsyncThunk<
  { ok: boolean; ttl?: number; message?: string },
  void,
  { rejectValue: string }
>(
  'adminAuth/otpResend',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await adminClient.post('/admin/auth/otp/resend', {});
      return data as { ok: boolean; ttl?: number; message?: string };
    } catch (error: unknown) {
      return rejectWithValue(getApiError(error, 'OTP_RESEND_FAILED'));
    }
  }
);

export const adminLogout = createAsyncThunk('adminAuth/logout', async () => {
  const { data } = await adminClient.post('/admin/auth/logout', {});
  return data as { ok: boolean };
});

const slice = createSlice({
  name: 'adminAuth',
  initialState,
  reducers: {
    adminSessionCleared(state) {
      state.status = 'not-authenticated';
      state.admin = null;
      state.error = null;
      state.otpRequired = false;
      state.otpEmail = null;
      state.otpTtl = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(adminMe.pending, (s) => {
      s.status = 'checking';
      s.error = null;
    });
    b.addCase(adminMe.fulfilled, (s, a) => {
      s.status = 'authenticated';
      s.admin = a.payload.admin;
      s.error = null;
      s.otpRequired = false;
      s.otpEmail = null;
      s.otpTtl = null;
    });
    b.addCase(adminMe.rejected, (s) => {
      s.status = 'not-authenticated';
      s.admin = null;
    });

    b.addCase(adminLogin.pending, (s) => {
      s.status = 'checking';
      s.error = null;
    });
    b.addCase(adminLogin.fulfilled, (s, a) => {
      if (a.payload.otp_required) {
        s.status = 'not-authenticated';
        s.admin = null;
        s.error = null;
        s.otpRequired = true;
        s.otpEmail = a.payload.email ?? null;
        s.otpTtl = a.payload.ttl ?? null;
        return;
      }

      s.status = 'authenticated';
      s.admin = a.payload.admin ?? null;
      s.error = null;
      s.otpRequired = false;
      s.otpEmail = null;
      s.otpTtl = null;
    });
    b.addCase(adminLogin.rejected, (s, a) => {
      s.status = 'not-authenticated';
      s.admin = null;
      s.error = (typeof a.payload === 'string' && a.payload) || 'LOGIN_FAILED';
      s.otpRequired = false;
      s.otpEmail = null;
      s.otpTtl = null;
    });

    b.addCase(adminOtpVerify.pending, (s) => {
      s.status = 'checking';
      s.error = null;
    });
    b.addCase(adminOtpVerify.fulfilled, (s, a) => {
      s.status = 'authenticated';
      s.admin = a.payload.admin;
      s.error = null;
      s.otpRequired = false;
      s.otpEmail = null;
      s.otpTtl = null;
    });
    b.addCase(adminOtpVerify.rejected, (s, a) => {
      s.status = 'not-authenticated';
      s.admin = null;
      s.error = (typeof a.payload === 'string' && a.payload) || 'OTP_FAILED';
      s.otpRequired = true;
    });

    b.addCase(adminOtpResend.fulfilled, (s, a) => {
      s.error = null;
      s.otpRequired = true;
      s.otpTtl = a.payload.ttl ?? s.otpTtl ?? null;
    });
    b.addCase(adminOtpResend.rejected, (s, a) => {
      s.error = (typeof a.payload === 'string' && a.payload) || 'OTP_RESEND_FAILED';
      s.otpRequired = true;
    });

    b.addCase(adminLogout.fulfilled, (s) => {
      s.status = 'not-authenticated';
      s.admin = null;
      s.error = null;
      s.otpRequired = false;
      s.otpEmail = null;
      s.otpTtl = null;
    });
  },
});

export const { adminSessionCleared } = slice.actions;
export default slice.reducer;
