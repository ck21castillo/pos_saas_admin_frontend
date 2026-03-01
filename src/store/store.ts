import { configureStore } from '@reduxjs/toolkit';
import adminAuthReducer from './adminAuthSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    adminAuth: adminAuthReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
