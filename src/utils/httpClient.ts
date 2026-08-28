import { CapacitorHttp } from '@capacitor/core';

const UA = 'LibriAudio/1.0 (Android; +https://libriaudio.app)';
const isCap = (): boolean =>
  typeof (window as any).Capacitor?.isNativePlatform === 'function' &&
  !!(window as any).Capacitor?.isNativePlatform?.();

function base64ToBlob(b64: string, mime = 'application/octet-stream'): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

export class HttpError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
    public readonly attempt: number,
    public readonly cause: Error | undefined,
  ) {
    super(`HTTP ${status || 'network'} for ${shorten(url)} (attempt ${attempt})`);
    this.name = 'HttpError';
  }
}

function shorten(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.length > 60 ? u.pathname.slice(0, 57) + '...' : u.pathname;
  } catch {
    return url.length > 60 ? url.slice(0, 57) + '...' : url;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attempt: number, base = 400): number {
  const exp = Math.min(base * 2 ** (attempt - 1), 8000);
  const jitter = exp * (0.5 + Math.random() * 0.5);
  return Math.round(jitter);
}

function shouldRetry(status: number): boolean {
  if (status === 0) return true;
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

interface HttpResult<T> {
  ok: boolean;
  data: T;
  status: number;
  attempts: number;
}

export async function httpGet(
  url: string,
  opts: RequestOptions & { as: 'text' },
): Promise<HttpResult<string>>;

export async function httpGet(
  url: string,
  opts: RequestOptions & { as: 'json' },
): Promise<HttpResult<any>>;

export async function httpGet(
  url: string,
  opts: RequestOptions & { as: 'blob' },
): Promise<HttpResult<Blob>>;

export async function httpGet(
  url: string,
  opts: RequestOptions & { as: 'arrayBuffer' },
): Promise<HttpResult<ArrayBuffer>>;

export async function httpGet(
  url: string,
  opts: RequestOptions & { as: 'text' | 'json' | 'blob' | 'arrayBuffer' } = { as: 'text' },
): Promise<HttpResult<any>> {
  const { timeout = 20000, retries = 2, headers = {}, as = 'text' } = opts;
  const mergedHeaders = { 'User-Agent': UA, ...headers };
  let lastErr: Error | undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      if (isCap()) {
        const responseType = as === 'json' ? 'json' : as === 'text' ? 'text' : 'blob';
        const acceptHeader =
          as === 'json' ? 'application/json, */*' : mergedHeaders['Accept'] || '*/*';
        const resp = await CapacitorHttp.request({
          method: 'GET',
          url,
          headers: { ...mergedHeaders, Accept: acceptHeader },
          responseType: responseType as any,
        });
        const status = resp.status ?? 0;
        if (status >= 200 && status < 400) {
          let data: any;
          if (as === 'json') {
            data = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
          } else if (as === 'text') {
            data = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
          } else if (as === 'blob') {
            data = typeof resp.data === 'string' ? base64ToBlob(resp.data) : resp.data;
          } else if (as === 'arrayBuffer') {
            data = typeof resp.data === 'string' ? base64ToArrayBuffer(resp.data) : resp.data;
          }
          return { ok: true, data, status, attempts: attempt };
        }
        lastErr = new Error(`HTTP ${status}`);
        if (!shouldRetry(status) || attempt > retries) {
          return { ok: false, data: as === 'json' ? null : as === 'blob' ? new Blob() : as === 'arrayBuffer' ? new ArrayBuffer(0) : '', status, attempts: attempt };
        }
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
          const res = await fetch(url, {
            headers: mergedHeaders,
            signal: controller.signal,
          });
          clearTimeout(timer);
          const status = res.status;
          if (res.ok) {
            let data: any;
            if (as === 'json') data = await res.json();
            else if (as === 'text') data = await res.text();
            else if (as === 'blob') data = await res.blob();
            else if (as === 'arrayBuffer') data = await res.arrayBuffer();
            return { ok: true, data, status, attempts: attempt };
          }
          lastErr = new Error(`HTTP ${status}`);
          if (!shouldRetry(status) || attempt > retries) {
            return { ok: false, data: as === 'json' ? null : as === 'blob' ? new Blob() : as === 'arrayBuffer' ? new ArrayBuffer(0) : '', status, attempts: attempt };
          }
        } catch (fetchErr: any) {
          clearTimeout(timer);
          const isAbort = fetchErr?.name === 'AbortError';
          lastErr = isAbort ? new Error(`Timeout after ${timeout}ms`) : fetchErr;
          if (attempt > retries) {
            return { ok: false, data: as === 'json' ? null : as === 'blob' ? new Blob() : as === 'arrayBuffer' ? new ArrayBuffer(0) : '', status: isAbort ? 408 : 0, attempts: attempt };
          }
        }
      }
    } catch (err: any) {
      lastErr = err;
      if (attempt > retries) break;
    }

    if (attempt <= retries) {
      await delay(backoff(attempt));
    }
  }

  throw new HttpError(url, 0, retries + 1, lastErr);
}

export async function httpGetText(
  url: string,
  opts: RequestOptions = {},
): Promise<HttpResult<string>> {
  return httpGet(url, { ...opts, as: 'text' });
}

export async function httpGetJson(
  url: string,
  opts: RequestOptions = {},
): Promise<HttpResult<any>> {
  return httpGet(url, { ...opts, as: 'json' });
}

export async function httpGetBlob(
  url: string,
  opts: RequestOptions = {},
): Promise<HttpResult<Blob>> {
  return httpGet(url, { ...opts, as: 'blob' });
}

export async function httpGetBuffer(
  url: string,
  opts: RequestOptions = {},
): Promise<HttpResult<ArrayBuffer>> {
  return httpGet(url, { ...opts, as: 'arrayBuffer' });
}
