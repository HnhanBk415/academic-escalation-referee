const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const ACCESS_TOKEN_KEY = "aer.access-token";

let lastRequestId: string | null = null;
let demoActorId: string | null = null;
let accessToken: string | null =
  typeof window === "undefined" ? null : window.sessionStorage.getItem(ACCESS_TOKEN_KEY);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string | null
  ) {
    super(message);
  }
}

export function getLastRequestId(): string | null {
  return lastRequestId;
}

export function setDemoActorId(actorId: string | null): void {
  demoActorId = actorId;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  else window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function hasAccessToken(): boolean {
  return Boolean(accessToken);
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (accessToken) {
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);
  } else if (demoActorId) {
    if (!headers.has("X-Demo-Actor-ID")) headers.set("X-Demo-Actor-ID", demoActorId);
  }
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });
  const reqId = response.headers.get("x-request-id");
  if (reqId) {
    lastRequestId = reqId;
  }
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? body?.detail ?? "Yêu cầu không thành công.",
      body?.error?.code ?? "UNKNOWN_ERROR",
      response.status,
      reqId
    );
  }
  return body as T;
}

export const postJson = <T>(path: string, payload: unknown, headers?: HeadersInit) =>
  api<T>(path, { method: "POST", body: JSON.stringify(payload), headers });

export async function apiBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  else if (demoActorId) headers.set("X-Demo-Actor-ID", demoActorId);
  const response = await fetch(`${API_BASE}${path}`, { headers });
  if (!response.ok) throw new Error("Không thể tải ảnh crop Local.");
  return response.blob();
}
