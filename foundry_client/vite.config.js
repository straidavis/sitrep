import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    base: './',
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/foundry-api': {
          target: 'https://shieldai.palantirfoundry.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/foundry-api/, ''),
          secure: false
        },
        '/.auth': {
          target: env.VITE_APP_SERVICE_URL || 'http://localhost:9999', // Fallback to avoid crash if unset, but obviously won't work
          changeOrigin: true,
          secure: false
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  }
})
