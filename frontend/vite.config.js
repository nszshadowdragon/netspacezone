// frontend/vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Load VITE_* from .env files
  const env = loadEnv(mode, process.cwd(), "");
  // Dev API origin (defaults to your local backend)
  const DEV_API = env.VITE_API_BASE_URL || "http://localhost:5000";
  // Optional: remote/deployed backend that serves /uploads (for fallback testing in dev)
  const REMOTE_UPLOADS = env.VITE_REMOTE_UPLOADS_ORIGIN || ""; // e.g. "https://api.your-prod.com"

  // Base proxy map
  const proxy = {
    // JSON API
    "/api": {
      target: DEV_API,
      changeOrigin: true,
      secure: false,
    },

    // Local uploads (served by your local backend)
    "/uploads": {
      target: DEV_API,
      changeOrigin: true,
      secure: false,
    },

    // Socket.IO (dev tunnel)
    "/socket.io": {
      target: DEV_API.replace(/^http/, "ws"),
      ws: true,
    },
  };

  // Optional: proxy your *production* uploads under /remote-uploads in dev
  // Only enabled if VITE_REMOTE_UPLOADS_ORIGIN is set.
  if (REMOTE_UPLOADS) {
    proxy["/remote-uploads"] = {
      target: REMOTE_UPLOADS,
      changeOrigin: true,
      secure: true, // allow https
      // Map /remote-uploads/... -> <REMOTE_UPLOADS>/uploads/...
      rewrite: (path) => path.replace(/^\/remote-uploads/, "/uploads"),
    };
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      cors: true,
      proxy,
      // If you ever serve Vite behind a reverse proxy, uncomment the next line:
      // hmr: { clientPort: 5173 },
    },
    build: { outDir: "dist" },
  };
});
