import type { Plugin } from 'vite';

export const MODEL_FILES: readonly string[];
export function negotiateModelEncoding(header?: string | null): string | null;
export function createModelTransportMiddleware(options?: { modelDir?: string }): unknown;
export function modelTransportPlugin(): Plugin;
