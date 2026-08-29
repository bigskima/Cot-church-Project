import type { MediaProvider } from './types.ts';
import { InternalStorageMediaProvider } from './internal.ts';
import { MuxMediaProvider } from './mux.ts';

const providers = new Map<string, MediaProvider>([
  ['internal', new InternalStorageMediaProvider()],
  ['mux', new MuxMediaProvider()],
]);

export function getMediaProvider(code?: string | null): MediaProvider {
  if (!code) return providers.get('internal')!;
  const provider = providers.get(code.toLowerCase());
  return provider ?? providers.get('internal')!;
}

export function registerMediaProvider(provider: MediaProvider): void {
  providers.set(provider.code.toLowerCase(), provider);
}
