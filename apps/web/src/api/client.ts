const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? body?.detail ?? "Yêu cầu không thành công.",
      body?.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }
  return body as T;
}

export const postJson = <T>(path: string, payload: unknown, headers?: HeadersInit) =>
  api<T>(path, { method: "POST", body: JSON.stringify(payload), headers });
