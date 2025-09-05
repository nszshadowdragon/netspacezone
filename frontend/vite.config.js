// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      // NEW: allow Socket.IO to tunnel through Vite in dev
      "/socket.io": {
        target: "ws://localhost:5000",
        ws: true,
      },
    },
  },
  build: { outDir: "dist" },
});
