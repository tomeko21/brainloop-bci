import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath, URL } from "node:url";

// npm run dev:mobile sets MOBILE=1: HTTPS on the LAN, phones only allow camera access over HTTPS
const mobile = process.env.MOBILE === "1";

// FastAPI backend (../backend)
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(mobile ? [basicSsl() as PluginOption] : [])],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: mobile ? true : undefined,
    // all backend traffic goes through the dev server, so same origin, no CORS, works from the phone
    proxy: {
      "/api": { target: backendUrl, changeOrigin: true },
      "/media/videos": { target: backendUrl, changeOrigin: true },  // not plain /media, that would also catch /mediapipe/*
      "/ws": { target: backendUrl.replace(/^http/, "ws"), ws: true, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // MediaPipe gets its own lazily loaded chunk
        manualChunks: (id) => (id.includes("@mediapipe") ? "mediapipe" : undefined),
      },
    },
  },
});
