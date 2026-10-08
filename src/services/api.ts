import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Native builds bundle the UI locally; public data still comes from our VPS.
export function apiUrl(path: string): string {
  return Capacitor.isNativePlatform() ? `https://downuptiles.com${path}` : path;
}

/** GET our public JSON APIs without requiring cross-origin browser permissions. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!Capacitor.isNativePlatform()) return fetch(path, init);
  const signal = init?.signal;
  signal?.throwIfAborted();
  let abort: (() => void) | undefined;
  try {
    const result = await Promise.race([
      CapacitorHttp.get({ url: apiUrl(path), responseType: 'json', connectTimeout: 10000, readTimeout: 10000 }),
      new Promise<never>((_, reject) => {
        abort = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        signal?.addEventListener('abort', abort, { once: true });
      }),
    ]);
    return new Response(JSON.stringify(result.data), { status: result.status, headers: result.headers });
  } finally {
    if (abort) signal?.removeEventListener('abort', abort);
  }
}
