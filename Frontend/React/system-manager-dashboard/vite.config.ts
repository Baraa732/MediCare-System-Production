import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// MediCare System Manager dashboard.
// Runs on port 3002 and proxies all `/api/*` requests to the NestJS gateway
// (default http://localhost:3000) so the browser never talks to the gateway
// directly. Override the target with VITE_API_PROXY_TARGET.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3000'

  return {
    plugins: [react()],
    server: {
      port: 3002,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 3002,
      strictPort: true,
    },
  }
})
