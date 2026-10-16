import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { modelTransportPlugin } from './tools/modelTransport.mjs';
import { offlineBuildPlugin } from './tools/offlineBuild.mjs';

export default defineConfig({
  plugins: [react(), modelTransportPlugin(), offlineBuildPlugin()],
  server: { port: 5173, strictPort: true, proxy: {"/api/online":"http://127.0.0.1:4180"} },
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          'three-vendor': ['three']
        }
      }
    }
  }
});
