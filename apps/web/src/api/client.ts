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
  const body = await response.json();
  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? "Yêu cầu không thành công.",
      body?.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }
  return body as T;
}

export const postJson = <T>(path: string, payload: unknown, headers?: HeadersInit) =>
  api<T>(path, { method: "POST", body: JSON.stringify(payload), headers });
