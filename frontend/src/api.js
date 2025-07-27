// src/api.js
import axios from 'axios';

// Base URL for all requests
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

// Include JWT from localStorage on every request
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export default axios;
