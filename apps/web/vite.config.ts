import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_TARGET = process.env.API_HOST
  ? `http://${process.env.API_HOST}:3001`
  : 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  // esbuild >= 0.25 no longer lowers destructuring for legacy targets; the
  // Vite 5 default target ("modules" = chrome87/firefox78/safari14) triggers
  // "Transforming destructuring ... is not supported yet". es2020 is native
  // for every supported browser and keeps the bundler agnostic.
  build: {
    target: 'es2020',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5192,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5192,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
