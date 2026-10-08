import { afterEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ enabled: false, get: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.enabled }, CapacitorHttp: { get: native.get } }));
import { apiFetch } from '../src/services/api';

afterEach(() => { native.enabled = false; native.get.mockReset(); vi.unstubAllGlobals(); });

it('keeps browser requests same-origin with their abort signal', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetcher);
  const signal = new AbortController().signal;
  await apiFetch('/api/world/quote?id=gold', { signal });
  expect(fetcher).toHaveBeenCalledWith('/api/world/quote?id=gold', { signal });
  expect(native.get).not.toHaveBeenCalled();
});

it('uses the production proxy on native and preserves rate-limit responses', async () => {
  native.enabled = true;
  native.get.mockResolvedValue({ status: 429, data: { error: 'Rate limited' }, headers: { 'Retry-After': '60' } });
  const response = await apiFetch('/api/mexc/ticker/24hr?symbol=BTCUSDT');
  expect(native.get).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://downuptiles.com/api/mexc/ticker/24hr?symbol=BTCUSDT', connectTimeout: 10000, readTimeout: 10000 }));
  expect(response.ok).toBe(false);
  expect(response.headers.get('Retry-After')).toBe('60');
  expect(await response.json()).toEqual({ error: 'Rate limited' });
});

it('rejects cancelled native calls promptly even if the HTTP plugin is still waiting', async () => {
  native.enabled = true;
  native.get.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const response = apiFetch('/api/world/quote?id=gold', { signal: controller.signal });
  controller.abort();
  await expect(response).rejects.toMatchObject({ name: 'AbortError' });
});

it('does not start an already cancelled native request', async () => {
  native.enabled = true;
  const controller = new AbortController();
  controller.abort();
  await expect(apiFetch('/api/world/quote?id=gold', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(native.get).not.toHaveBeenCalled();
});
