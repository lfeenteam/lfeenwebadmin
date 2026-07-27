import { ErrorHandler, Injectable, NgZone } from '@angular/core';

// After a new deploy, browsers/proxies that still hold an old index.html
// reference lazy-loaded chunk files that no longer exist on the server.
// This reloads the page once to pick up the new build instead of leaving
// the user stuck on a broken navigation.
const RELOAD_FLAG_KEY = 'chunk-load-error-reloaded';
const CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'chunkloaderror',
];

@Injectable()
export class ChunkLoadErrorHandler implements ErrorHandler {
  constructor(private zone: NgZone) {}

  handleError(error: unknown): void {
    const message = this.extractMessage(error).toLowerCase();
    const isChunkLoadError = CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));

    if (isChunkLoadError && !sessionStorage.getItem(RELOAD_FLAG_KEY)) {
      sessionStorage.setItem(RELOAD_FLAG_KEY, '1');
      this.zone.runOutsideAngular(() => window.location.reload());
      return;
    }

    console.error(error);
  }

  private extractMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return '';
  }
}
