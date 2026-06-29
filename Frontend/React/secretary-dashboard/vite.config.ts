import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 800, // Increase this to 800kB or higher
  },
  base: process.env.NODE_ENV === "production" ? "/CMS_Project/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "firebase/app": path.resolve(
        __dirname,
        "node_modules/firebase/app/dist/esm/index.esm.js",
      ),
      "firebase/messaging": path.resolve(
        __dirname,
        "node_modules/firebase/messaging/dist/esm/index.esm.js",
      ),
    },
  },
  optimizeDeps: {
    include: ["firebase/app", "firebase/messaging"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
