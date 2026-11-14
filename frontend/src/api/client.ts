/**
 * Shared API client.
 *
 * For now the WHOLE app runs on mocks (USE_MOCKS = true).
 * Once the FastAPI backend is ready: set VITE_USE_MOCKS=false in .env
 * and every function in the *.api.ts files will switch to the real `http()`.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? "true") !== "false";

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type HttpOptions = Omit<RequestInit, "body"> & { body?: unknown };

/** Real fetch to the backend (used when USE_MOCKS === false). */
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

/** MOCK: simulates network latency so loaders and animations are visible. */
export function mockDelay(min = 180, max = 520): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
