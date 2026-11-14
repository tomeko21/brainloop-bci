/**
 * Shared API client – every request goes to the FastAPI backend (../backend).
 *
 * In dev the Vite server proxies /api, /media and /ws to the backend (see vite.config.ts),
 * so the default base URL is "" (same origin). Set VITE_API_URL only when the frontend
 * is served separately from the API (e.g. a production build on another host).
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type HttpOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function http<T>(path: string, { body, headers, ...init }: HttpOptions = {}): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: isForm ? headers : { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return (await res.json()) as T;
}

/** Absolute URL for media served by the backend (videos). */
export const mediaUrl = (path: string) => `${API_BASE_URL}${path}`;

/** ws:// or wss:// URL for a backend WebSocket path. */
export function wsUrl(path: string): string {
  const base = API_BASE_URL || window.location.origin;
  return base.replace(/^http/, "ws") + path;
}

export const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q.set(k, String(v));
  return q.toString();
};
