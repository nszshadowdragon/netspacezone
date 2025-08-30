import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api from '../api';
import { useAuth } from './AuthContext';

const ThemeContext = createContext({ theme: 'normal1', setTheme: () => {}, ready: false });

const THEMES = ['light', 'normal1', 'normal2', 'dark', 'custom'];
const DEFAULT = 'normal1';

const normalize = (t) => (THEMES.includes(t) ? t : DEFAULT);
const perKey = (uid) => (uid ? `nsz_theme:${uid}` : null);

function getToken() {
  const keys = ['authToken', 'token', 'jwt', 'accessToken'];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

function uidFromJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const data = JSON.parse(json);
    return (
      data?._id || data?.id || data?.userId || data?.username || data?.email || null
    );
  } catch {
    return null;
  }
}

function uidFromLocalUser() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return u?._id || u?.id || u?.username || u?.email || null;
  } catch {
    return null;
  }
}

function saveTheme(uid, theme) {
  const key = perKey(uid);
  if (key) localStorage.setItem(key, theme);
  localStorage.setItem('nsz_theme:last_theme', theme);
  localStorage.setItem('nsz_theme:last_uid', uid || '');
}

function loadTheme(uid) {
  const key = perKey(uid);
  return (
    (key && localStorage.getItem(key)) ||
    localStorage.getItem('nsz_theme:last_theme') ||
    DEFAULT
  );
}

function applyThemeToDOM(theme) {
  const root = document.documentElement;
  const domTheme = theme;
  root.setAttribute('data-theme', domTheme);
  THEMES.forEach((t) => root.classList.toggle(`theme-${t}`, t === domTheme));
}

async function fetchMe() {
  const endpoints = ['/users/me', '/auth/me', '/me'];
  for (const url of endpoints) {
    try {
      const res = await api.get(url);
      if (res?.data) return res.data;
    } catch {}
  }
  return null;
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT);
  const [userId, setUserId] = useState(null);
  const [ready, setReady] = useState(false);
  const { updateUser } = useAuth();
  const hydrated = useRef(false);

  useLayoutEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  useEffect(() => {
    const hydrate = async () => {
      const token = getToken();
      const localUid = uidFromLocalUser() || (token ? uidFromJwt(token) : null);
      let uid = localUid;

      const me = await fetchMe();
      if (me) {
        uid = me._id || me.id || me.username || me.email || uid;
      }

      setUserId(uid);

      const fromLocal = loadTheme(uid);
      const fromServer = me?.theme;

      const selected = normalize(fromServer || fromLocal || DEFAULT);
      setTheme(selected);
      saveTheme(uid, selected);
      hydrated.current = true;
      setReady(true);
    };

    hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated.current || !userId) return;

    const saveThemeToServer = async (theme) => {
      try {
        await api.put('/me', { theme });
        const res = await api.get('/me');
        if (res?.data) updateUser(res.data);
      } catch (err) {
        console.error('Theme save failed:', err);
      }
    };

    saveTheme(userId, theme);
    saveThemeToServer(theme);
  }, [theme, userId, updateUser]);

  const value = useMemo(() => ({ theme, setTheme, ready }), [theme, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
