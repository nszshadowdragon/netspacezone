// frontend/src/utils/auth.js

// Save token to localStorage
export function saveToken(token) {
  localStorage.setItem('token', token);
}

// Get token from localStorage
export function getToken() {
  return localStorage.getItem('token');
}

// Remove token from localStorage
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// Save current user info
export function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

// Get current user info
export function getCurrentUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}
