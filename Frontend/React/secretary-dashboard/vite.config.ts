import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor-react", test: /node_modules\/(react|react-dom|react-router)/ },
            { name: "vendor-firebase", test: /node_modules\/firebase/ },
            { name: "vendor-dnd", test: /node_modules\/@dnd-kit/ },
            { name: "vendor-ui", test: /node_modules\/(radix-ui|vaul|@radix-ui)/ },
            { name: "vendor-dates", test: /node_modules\/date-fns/ },
            { name: "vendor-forms", test: /node_modules\/(react-hook-form|@hookform|zod)/ },
          ],
        },
      },
    },
  },
  base: "/",
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
