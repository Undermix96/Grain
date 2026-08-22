import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // During local development, the frontend runs on Vite's dev server
      // while the backend runs separately (e.g. via `npm run dev` in
      // backend/). This proxy lets the frontend call relative /api paths
      // without hardcoding a backend URL or dealing with CORS locally.
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
