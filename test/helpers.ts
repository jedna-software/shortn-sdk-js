import { Shortn, type ShortnOptions } from "../src";

export interface RecordedRequest {
  url: URL;
  method: string;
  headers: Headers;
  body: unknown;
}

type Responder = Response | ((request: RecordedRequest, attempt: number) => Response | Promise<Response>);

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

/**
 * A client whose fetch records each request and answers from `responses` in
 * order (the last one repeats). Default answer: `200 {}`.
 */
export function mockClient(responses: Responder[] = [], options: ShortnOptions = {}) {
  const requests: RecordedRequest[] = [];
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const raw = init?.body;
    const request: RecordedRequest = {
      body: typeof raw === "string" ? JSON.parse(raw) : undefined,
      headers: new Headers(init?.headers),
      method: init?.method ?? "GET",
      url
    };
    requests.push(request);
    const responder = responses[Math.min(requests.length - 1, responses.length - 1)];
    if (responder === undefined) return jsonResponse({});
    if (typeof responder === "function") return responder(request, requests.length);
    return responder.clone();
  };
  const client = new Shortn({
    apiKey: "sk_live_test",
    baseUrl: "https://api.example.test",
    retry: { initialDelayMs: 0, jitter: false, maxDelayMs: 0 },
    ...options,
    fetch
  });
  return { client, requests };
}

/** The request path below /api/v1, still URL-escaped. */
export function apiPath(request: RecordedRequest): string {
  return request.url.pathname.replace(/^\/api\/v1/, "");
}

export function query(request: RecordedRequest): Record<string, string> {
  return Object.fromEntries(request.url.searchParams.entries());
}
