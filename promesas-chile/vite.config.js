import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// SPA interna autenticada — no requiere SSR.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
});
