// src/main.tsx
import 'bootstrap/dist/css/bootstrap.min.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/store';
import './styles/global.css';
import App from './App';

try {
  const c = JSON.parse(localStorage.getItem('sidebarCollapsed') ?? 'false');
  if (c) document.body.classList.add('has-collapsed');
} catch {
  // Ignorar errores de acceso/parsing de localStorage en el arranque.
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
