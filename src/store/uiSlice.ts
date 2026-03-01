import { createSlice } from '@reduxjs/toolkit';

type UIState = { sidebarCollapsed: boolean };

const initialState: UIState = {
  sidebarCollapsed: (() => {
    try { return JSON.parse(localStorage.getItem('sidebarCollapsed') ?? 'false'); }
    catch {
      return false;
    }
  })(),
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      try { localStorage.setItem('sidebarCollapsed', JSON.stringify(state.sidebarCollapsed)); }
      catch {
        // Ignorar errores de localStorage (modo privado/restricciones del navegador).
      }
    },
    setSidebar(state, action: { payload: boolean }) {
      state.sidebarCollapsed = !!action.payload;
      try { localStorage.setItem('sidebarCollapsed', JSON.stringify(state.sidebarCollapsed)); }
      catch {
        // Ignorar errores de localStorage (modo privado/restricciones del navegador).
      }
    },
  },
});

export const { toggleSidebar, setSidebar } = uiSlice.actions;
export default uiSlice.reducer;
