import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "../src/lib/http";

describe("shared HTTP client", () => {
  it("sends JSON and the current bearer token while retaining caller headers", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: { id: "123" } }, { status: 201 }),
      );
    const client = createApiClient({
      baseUrl: "/api/v1/",
      getAccessToken: () => "memory-token",
      fetcher,
    });
    expect(
      await client.request("/books", {
        method: "POST",
        json: { title: "A book" },
        headers: { "If-Match": '"v1"' },
      }),
    ).toEqual({ data: { id: "123" } });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v1/books");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer memory-token");
    expect(headers.get("If-Match")).toBe('"v1"');
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.credentials).toBe("same-origin");
    expect(init?.body).toBe('{"title":"A book"}');
  });

  it("does not attempt to parse a 204 response", async () => {
    const client = createApiClient({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 204 })),
    });
    expect(
      await client.request<void>("/books/123", { method: "DELETE" }),
    ).toBeUndefined();
  });

  it("exposes response headers for conditional requests and handles 304 without a body", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { data: { title: "A book" } },
          { headers: { ETag: '"book-v1"' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 304, headers: { ETag: '"book-v1"' } }),
      );
    const client = createApiClient({ fetcher });
    const resource = await client.requestWithMetadata<{
      data: { title: string };
    }>("/books/123");
    expect(resource.headers.get("ETag")).toBe('"book-v1"');
    expect(resource.data.data.title).toBe("A book");
    const cached = await client.requestWithMetadata<void>("/books/123", {
      headers: { "If-None-Match": resource.headers.get("ETag")! },
    });
    expect(cached.status).toBe(304);
    expect(cached.data).toBeUndefined();
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).get("If-None-Match"),
    ).toBe('"book-v1"');
  });

  it("accepts a successful HEAD without JSON while preserving failed HEAD responses", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const client = createApiClient({ fetcher });
    expect(
      await client.request<void>("/books/123", { method: "HEAD" }),
    ).toBeUndefined();
    await expect(
      client.request("/books/123", { method: "HEAD" }),
    ).rejects.toMatchObject({ problem: { status: 503 } });
  });

  it("maps Problem Details and preserves a request ID", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          type: "urn:bookflow:problem:conflict",
          title: "Conflict",
          detail: "No copies available.",
          code: "BOOK_UNAVAILABLE",
        },
        { status: 409, headers: { "X-Request-Id": "request-123" } },
      ),
    );
    const client = createApiClient({ fetcher });
    try {
      await client.request("/loans", {
        method: "POST",
        json: { bookId: "123" },
      });
      expect.fail("request should fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).problem).toMatchObject({
        status: 409,
        code: "BOOK_UNAVAILABLE",
        requestId: "request-123",
      });
      expect((error as Error).message).toBe("No copies available.");
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("handles an HTML gateway error without exposing its markup", async () => {
    const client = createApiClient({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("<html>gateway traceback</html>", { status: 502 }),
        ),
    });
    await expect(client.request("/books")).rejects.toMatchObject({
      message: "Request failed (HTTP 502)",
      problem: { status: 502 },
    });
  });

  it("rejects invalid success responses", async () => {
    const client = createApiClient({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("not-json", { status: 200 })),
    });
    await expect(client.request("/books")).rejects.toBeInstanceOf(ApiError);
  });

  it("passes abort through without wrapping or retrying the request", async () => {
    const controller = new AbortController();
    const abort = new DOMException("Cancelled", "AbortError");
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(abort);
    const client = createApiClient({ fetcher });
    await expect(
      client.request("/books", { signal: controller.signal }),
    ).rejects.toBe(abort);
    expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not retry a mutation after an uncertain network failure", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("Network unavailable"));
    await expect(
      createApiClient({ fetcher }).request("/loans", {
        method: "POST",
        json: { bookId: "123" },
      }),
    ).rejects.toThrow("Network unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects absolute request destinations before attaching a token", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      createApiClient({ fetcher, getAccessToken: () => "secret" }).request(
        "//other.example/books",
      ),
    ).rejects.toThrow(TypeError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
