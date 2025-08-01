// src/socket.js
import { io } from 'socket.io-client';

// Make sure this points to your backend port!
const SOCKET_URL = import.meta.env?.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: true,
});

export default socket;
