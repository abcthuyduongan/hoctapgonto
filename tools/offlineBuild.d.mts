import type { Plugin } from 'vite';
export function writeOfflineWorker(outDir: string): Promise<{ buildId: string; cacheName: string; manifest: {url:string;revision:string}[] }>;
export function offlineBuildPlugin(): Plugin;
