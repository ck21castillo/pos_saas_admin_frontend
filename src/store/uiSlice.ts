import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'light' | 'dark';

type UIState = {
  sidebarCollapsed: boolean;
  theme: ThemeMode;
};

function readTheme(): ThemeMode {
  try {
    return String(localStorage.getItem('themeMode') ?? 'light').toLowerCase() === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

const initialState: UIState = {
  sidebarCollapsed: (() => {
    try { return JSON.parse(localStorage.getItem('sidebarCollapsed') ?? 'false'); }
    catch {
      return false;
    }
  })(),
  theme: readTheme(),
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
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('themeMode', state.theme); }
      catch {
        // Ignorar errores de localStorage (modo privado/restricciones del navegador).
      }
    },
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
      try { localStorage.setItem('themeMode', state.theme); }
      catch {
        // Ignorar errores de localStorage (modo privado/restricciones del navegador).
      }
    },
  },
});

export const { toggleSidebar, setSidebar, toggleTheme, setTheme } = uiSlice.actions;
export default uiSlice.reducer;
