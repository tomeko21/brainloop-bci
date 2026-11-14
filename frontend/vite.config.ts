import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath, URL } from "node:url";

/**
 * `npm run dev:mobile` (MOBILE=1) -> HTTPS + listening on the LAN.
 * The phone requires HTTPS, otherwise the browser will not grant camera access.
 */
const mobile = process.env.MOBILE === "1";

/** FastAPI backend (see ../backend). */
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(mobile ? [basicSsl() as PluginOption] : [])],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    host: mobile ? true : undefined,
    // All API traffic goes through the dev server -> same origin, no CORS, works from the phone over HTTPS
    proxy: {
      "/api": { target: backendUrl, changeOrigin: true },
      // NOTE: not just "/media" – that prefix would also catch /mediapipe/* (local MediaPipe files)
      "/media/videos": { target: backendUrl, changeOrigin: true },
      "/ws": { target: backendUrl.replace(/^http/, "ws"), ws: true, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("@mediapipe") ? "mediapipe" : undefined),
      },
    },
  },
});
