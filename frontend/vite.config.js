import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000", // backend dev server
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist", // ✅ Vercel will serve from dist
  },
});
