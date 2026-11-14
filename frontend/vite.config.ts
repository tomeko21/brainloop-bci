import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { fileURLToPath, URL } from "node:url";
import { localDataSink } from "./vite/localDataSink";

/**
 * `npm run dev:mobile` (MOBILE=1) -> HTTPS + listening on the LAN.
 * The phone requires HTTPS, otherwise the browser will not grant camera access.
 */
const mobile = process.env.MOBILE === "1";

/** Folder for session data (default <repo>/data, next to frontend/). */
const dataDir = process.env.LOCAL_DATA_DIR ?? fileURLToPath(new URL("../data", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), localDataSink(dataDir), ...(mobile ? [basicSsl() as PluginOption] : [])],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: mobile ? { host: true } : undefined,
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("@mediapipe") ? "mediapipe" : undefined),
      },
    },
  },
});
