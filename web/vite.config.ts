import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Static SPA. Data + minimaps live in /public and are served as-is.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", chunkSizeWarningLimit: 2000 },
});
