// src/context/AuthContext.jsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';              // ← our axios instance
import { useTheme } from './ThemeContext';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  // Try to hydrate user info from localStorage
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem('nsz_user')) || null;
    } catch {
      return null;
    }
  })();

  const [user, setUser] = useState(storedUser);
  const { setTheme } = useTheme();

  // Configure baseURL once
  api.defaults.baseURL = import.meta.env.VITE_API_BASE_URL;

  // On mount: if we have a token, set header + fetch /me
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    // apply saved theme immediately
    if (storedUser?.theme) {
      setTheme(storedUser.theme);
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.get('/me')
      .then(({ data }) => {
        setUser(data);
        localStorage.setItem('nsz_user', JSON.stringify(data));
        if (data.theme) setTheme(data.theme);
      })
      .catch(err => {
        console.error('Failed to fetch /me:', err);
        // cleanup on invalid token
        localStorage.removeItem('authToken');
        localStorage.removeItem('nsz_user');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
      });
  }, [setTheme]);

  // login: persist token + user data
  const login = async ({ token }) => {
    // save the JWT
    localStorage.setItem('authToken', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    try {
      const { data } = await api.get('/me');
      setUser(data);
      localStorage.setItem('nsz_user', JSON.stringify(data));
      if (data.theme) {
        setTheme(data.theme);
      }
    } catch (err) {
      console.error('Failed post-login fetch /me:', err);
      // rollback on error
      localStorage.removeItem('authToken');
      localStorage.removeItem('nsz_user');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      throw err;
    }
  };

  // logout: clear stored data
  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('nsz_user');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // updateUser: merge & persist local changes (e.g. theme)
  const updateUser = (updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('nsz_user', JSON.stringify(updated));
      return updated;
    });
    if (updates.theme) {
      setTheme(updates.theme);
      // persist theme change server-side
      api.put('/me', { theme: updates.theme }).catch(e => {
        console.error('Failed to save theme:', e);
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}