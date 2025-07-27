// src/context/ThemeContext.jsx
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
} from 'react';
import axios from '../api';

/* ───────── Context ───────── */
export const ThemeContext = createContext();

/* ───────── Provider ───────── */
export function ThemeProvider({ children }) {
  /* #2 – initial theme from localStorage (fallback) */
  const stored = localStorage.getItem('nsz_theme');
  const [theme, setTheme] = useState(stored || 'normal');

  /* ── On mount: fetch theme from backend ── */
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    let canceled = false;

    axios
      .get('/me')
      .then(({ data }) => {
        if (!canceled && data.theme) {
          setTheme(data.theme);
          localStorage.setItem('nsz_theme', data.theme); // cache
        }
      })
      .catch(err => {
        /* silent network/auth errors */
        console.debug('[ThemeContext] GET /me failed', err?.response?.status);
      });

    return () => { canceled = true; };
  }, []);

  /* ── Persist theme when it changes ── */
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const controller = new AbortController();

    axios
      .put('/me', { theme }, { signal: controller.signal })
      .catch(err => {
        if (err.name !== 'CanceledError') {
          console.debug('[ThemeContext] PUT /me failed', err?.response?.status);
        }
      });

    /* cache locally so next load uses it immediately */
    localStorage.setItem('nsz_theme', theme);

    return () => controller.abort();
  }, [theme]);

  /* #1 – memoize context value */
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ───────── Hook ───────── */
export function useTheme() {
  return useContext(ThemeContext);
}

/* default export kept for backward-compat */
export default ThemeContext;
