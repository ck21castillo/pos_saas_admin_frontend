import React, { useEffect, useRef } from 'react';
import { HashRouter, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from './store/store';
import { adminMe } from './store/adminAuthSlice';
import AppRouter from './routes/AppRouter';

const PUBLIC_PATHS = ['/login'];

function InitAuth({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const ranRef = useRef(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some(p => location.pathname.startsWith(p));
    if (isPublic) return;
    if (ranRef.current) return;
    ranRef.current = true;
    dispatch(adminMe());
  }, [dispatch, location.pathname]);

  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <InitAuth>
        <AppRouter />
      </InitAuth>
    </HashRouter>
  );
}
