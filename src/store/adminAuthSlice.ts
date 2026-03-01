import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import adminClient from '../api/adminClient';

type AdminUser = { id: number; email: string };

type State = {
  status: 'checking' | 'authenticated' | 'not-authenticated';
  admin: AdminUser | null;
  error?: string | null;
};

const initialState: State = {
  status: 'checking',
  admin: null,
  error: null,
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

export const adminMe = createAsyncThunk('adminAuth/me', async () => {
  const { data } = await adminClient.get('/admin/auth/me');
  return data as { ok: boolean; admin: AdminUser };
});

export const adminLogin = createAsyncThunk<
  { ok: boolean; admin: AdminUser; message?: string },
  { email: string; password: string },
  { rejectValue: string }
>(
  'adminAuth/login',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await adminClient.post('/admin/auth/login', payload);
      return data as { ok: boolean; admin: AdminUser; message?: string };
    } catch (error: unknown) {
      const e = (error ?? {}) as ApiErrorLike;
      const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'LOGIN_FAILED';
      return rejectWithValue(String(msg));
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
  reducers: {},
  extraReducers: (b) => {
    b.addCase(adminMe.pending, (s) => {
      s.status = 'checking';
      s.error = null;
    });
    b.addCase(adminMe.fulfilled, (s, a) => {
      s.status = 'authenticated';
      s.admin = a.payload.admin;
      s.error = null;
    });
    b.addCase(adminMe.rejected, (s) => {
      s.status = 'not-authenticated';
      s.admin = null;
    });

    b.addCase(adminLogin.fulfilled, (s, a) => {
      s.status = 'authenticated';
      s.admin = a.payload.admin;
      s.error = null;
    });
    b.addCase(adminLogin.rejected, (s, a) => {
      s.status = 'not-authenticated';
      s.admin = null;
      s.error = (typeof a.payload === 'string' && a.payload) || 'LOGIN_FAILED';
    });

    b.addCase(adminLogout.fulfilled, (s) => {
      s.status = 'not-authenticated';
      s.admin = null;
      s.error = null;
    });
  },
});

export default slice.reducer;
