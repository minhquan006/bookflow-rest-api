export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  requestId?: string;
  errors?: Array<{ path: string; message: string }>;
};

export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.problem = problem;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit;
  json?: unknown;
};
type ClientOptions = {
  baseUrl?: string;
  getAccessToken?: () => string | null;
  fetcher?: typeof fetch;
};

export type ApiResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

export function createApiClient({
  baseUrl = "/api/v1",
  getAccessToken,
  fetcher = (...args) => fetch(...args),
}: ClientOptions = {}) {
  async function requestWithMetadata<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    if (path !== "" && (!path.startsWith("/") || path.startsWith("//"))) {
      throw new TypeError(
        "API paths must be empty or start with a single slash.",
      );
    }
    const { json, body, ...init } = options;
    if (json !== undefined && body !== undefined)
      throw new TypeError("Use either json or body for a request.");
    const headers = new Headers(init.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    const token = getAccessToken?.();
    if (token && !headers.has("Authorization"))
      headers.set("Authorization", `Bearer ${token}`);
    if (json !== undefined) headers.set("Content-Type", "application/json");

    // Mutations must not retry automatically: a timeout can follow a commit.
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}${path}`, {
      credentials: "same-origin",
      ...init,
      headers,
      body: json !== undefined ? JSON.stringify(json) : body,
    });
    if (
      response.status === 204 ||
      response.status === 304 ||
      (response.ok && init.method?.toUpperCase() === "HEAD")
    ) {
      return {
        data: undefined as T,
        status: response.status,
        headers: response.headers,
      };
    }
    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (!response.ok) {
      const candidate = parsed && typeof parsed === "object" ? parsed : {};
      const problem: ProblemDetails = {
        type: "about:blank",
        title: `Request failed (HTTP ${response.status})`,
        ...(candidate as Partial<ProblemDetails>),
        status: response.status,
      };
      problem.requestId ??= response.headers.get("X-Request-Id") ?? undefined;
      throw new ApiError(problem);
    }
    if (parsed === undefined)
      throw new ApiError({
        type: "about:blank",
        title: "Unexpected API response",
        status: response.status,
        detail: "The server returned an empty or invalid JSON response.",
      });
    return {
      data: parsed as T,
      status: response.status,
      headers: response.headers,
    };
  }

  return {
    requestWithMetadata,
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      return (await requestWithMetadata<T>(path, options)).data;
    },
  };
}

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "/api/v1",
});
