import { loadConfig } from './config.js';
import { AuthError, GSCError } from './errors.js';
import { USER_AGENT } from './version.js';

/**
 * Resolves a Google API key for key-based APIs (CrUX, PageSpeed Insights):
 *   --api-key flag → GOOGLE_API_KEY env → stored google_api_key.
 * These APIs are separate from the OAuth/service-account GSC surface.
 */
export async function resolveApiKey(flagKey?: string): Promise<string> {
  if (flagKey) return flagKey;
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  const config = await loadConfig();
  if (config?.google_api_key) return config.google_api_key;
  throw new AuthError(
    'No Google API key. Set GOOGLE_API_KEY, pass --api-key, or run: gsc config set-api-key <key>. ' +
      'Create one at Google Cloud Console → Credentials → API key (enable the CrUX and PageSpeed Insights APIs).',
  );
}

/** GET a JSON endpoint with the API key appended as `?key=`. */
export async function webGetJson<T>(url: string, params: Record<string, unknown>, apiKey: string): Promise<T> {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((item) => u.searchParams.append(k, String(item)));
    else u.searchParams.set(k, String(v));
  }
  u.searchParams.set('key', apiKey);
  return request<T>(u.toString(), { method: 'GET' });
}

/** POST a JSON body to an endpoint with the API key appended as `?key=`. */
export async function webPostJson<T>(url: string, body: unknown, apiKey: string): Promise<T> {
  const u = new URL(url);
  u.searchParams.set('key', apiKey);
  return request<T>(u.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    let message = res.statusText;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message ?? message;
    } catch {
      /* non-JSON error body */
    }
    const code = res.status === 401 || res.status === 403 ? 'AUTH_ERROR' : 'API_ERROR';
    throw new GSCError(message, code, res.status);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
