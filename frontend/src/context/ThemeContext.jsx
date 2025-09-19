// frontend/src/context/ThemeContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext({
  theme: "normal1",
  setTheme: () => {},
  ready: false,
});

const THEMES = ["light", "normal1", "normal2", "dark", "custom"];
const DEFAULT = "normal1";

const THEME_VARS = {
  light: {
    "--bg-color": "#ffffff",
    "--text-color": "#222222",
    "--primary-color": "#ffe259",
    "--bg-color-darker": "#f0f0f0",
    "--text-color-light": "#666666",
  },
  normal1: {
    "--bg-color": "#000000",
    "--text-color": "#ffe259",
    "--primary-color": "#ffe259",
    "--bg-color-darker": "#111111",
    "--text-color-light": "#bbb",
  },
  normal2: {
    "--bg-color": "#111111",
    "--text-color": "#ffcc00",
    "--primary-color": "#ffcc00",
    "--bg-color-darker": "#222222",
    "--text-color-light": "#ccc",
  },
  dark: {
    "--bg-color": "#0d0d0d",
    "--text-color": "#f5f5f5",
    "--primary-color": "#ff9900",
    "--bg-color-darker": "#1a1a1a",
    "--text-color-light": "#aaa",
  },
  custom: {
    "--bg-color": "#121212",
    "--text-color": "#00ffcc",
    "--primary-color": "#00ccff",
    "--bg-color-darker": "#1e1e1e",
    "--text-color-light": "#88ffff",
  },
};

const normalize = (t) => (THEMES.includes(t) ? t : DEFAULT);

function getToken() {
  const keys = ["authToken", "token", "jwt", "accessToken"];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

function uidFromJwt(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json);
    return data?._id || data?.id || data?.userId || data?.username || data?.email || null;
  } catch {
    return null;
  }
}

function uidFromLocalUser() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u?._id || u?.id || u?.username || u?.email || null;
  } catch {
    return null;
  }
}

function saveThemeLocal(uid, theme) {
  const key = uid ? `nsz_theme:${uid}` : null;
  if (key) localStorage.setItem(key, theme);
  localStorage.setItem("nsz_theme:last_theme", theme);
  localStorage.setItem("nsz_theme:last_uid", uid || "");
}

function loadTheme(uid) {
  const key = uid ? `nsz_theme:${uid}` : null;
  return (key && localStorage.getItem(key)) || localStorage.getItem("nsz_theme:last_theme") || DEFAULT;
}

function applyThemeToDOM(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  THEMES.forEach((t) => root.classList.toggle(`theme-${t}`, t === theme));

  // Apply CSS variables globally
  const vars = THEME_VARS[theme] || THEME_VARS[DEFAULT];
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

async function fetchMe() {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await axios.get("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch {
    return null;
  }
}

async function saveThemeServer(theme) {
  const token = getToken();
  if (!token) return;
  try {
    await axios.put(
      "/api/users/theme",
      { theme },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error("Theme save failed:", err);
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT);
  const [userId, setUserId] = useState(null);
  const [ready, setReady] = useState(false);
  const { updateUser } = useAuth();
  const hydrated = useRef(false);

  // Apply theme immediately to DOM
  useLayoutEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // Hydrate user and theme on mount
  useEffect(() => {
    const hydrate = async () => {
      const token = getToken();
      const localUid = uidFromLocalUser() || (token ? uidFromJwt(token) : null);
      let uid = localUid;

      const me = await fetchMe();
      if (me) uid = me._id || me.id || me.username || me.email || uid;

      setUserId(uid);

      const fromLocal = loadTheme(uid);
      const fromServer = me?.theme;
      const selected = normalize(fromServer || fromLocal || DEFAULT);

      setTheme(selected);
      saveThemeLocal(uid, selected);

      hydrated.current = true;
      setReady(true);
    };

    hydrate();
  }, []);

  // Save theme when it changes
  useEffect(() => {
    if (!hydrated.current || !userId) return;

    saveThemeLocal(userId, theme);
    saveThemeServer(theme);
  }, [theme, userId]);

  const value = useMemo(() => ({ theme, setTheme, ready }), [theme, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
