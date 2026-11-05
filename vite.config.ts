import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {onlineBuildPlugin} from './tools/onlineBuild.mjs';
import {createBuildIdentity} from './tools/buildIdentity.mjs';

export default defineConfig(async()=>{
 const identity=await createBuildIdentity();
 return {
  publicDir:'public',
  define:{__BAO_AN_BUILD_INFO__:JSON.stringify(identity)},
  plugins: [react(),onlineBuildPlugin(identity)],
  server: { port: 5173, strictPort: true, proxy: {"/api/online":"http://127.0.0.1:4180"} },
  build: {
    copyPublicDir:false,
    target: 'es2022',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 300,
  }
 };
});
