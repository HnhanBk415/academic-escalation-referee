import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, postJson } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("returns JSON and adds the content type for JSON posts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(postJson<{ ok: boolean }>("/api/test", { value: 1 })).resolves.toEqual({
      ok: true,
    });

    const [, request] = fetchMock.mock.calls[0];
    expect(request.method).toBe("POST");
    expect(new Headers(request.headers).get("Content-Type")).toBe("application/json");
  });

  it("turns the structured backend error into ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "COURSE_NOT_FOUND", message: "Không tìm thấy học phần." },
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const request = api("/api/v1/courses/missing");
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      code: "COURSE_NOT_FOUND",
      status: 404,
      message: "Không tìm thấy học phần.",
    });
  });

  it("preserves a network failure so the UI can report connectivity issues", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(api("/health/ai")).rejects.toThrow("fetch failed");
  });
});
