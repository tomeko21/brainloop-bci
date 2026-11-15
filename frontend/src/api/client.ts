// Fetch helpers for the FastAPI backend. In dev Vite proxies /api, /media/videos and /ws, so the base URL stays
// empty (same origin). Set VITE_API_URL only when the API is served from another host.
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

export const mediaUrl = (path: string) => `${API_BASE_URL}${path}`;

export function wsUrl(path: string): string {
  const base = API_BASE_URL || window.location.origin;
  return base.replace(/^http/, "ws") + path;
}

export const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) q.set(k, String(v));
  return q.toString();
};
