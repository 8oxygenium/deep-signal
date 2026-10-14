import { defineConfig } from 'vite';

// Electron から file:// で読むため base は相対パス
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 3000,
  },
  server: { port: 5199, strictPort: true },
});
