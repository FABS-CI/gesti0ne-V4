import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { applySecurityHeaders } from "./lib/security-headers";

function requestHost(request: Request): string {
  try {
    return request.headers.get("host") ?? new URL(request.url).host;
  } catch {
    return "";
  }
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function formatServerError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function requestPath(request: Request): string {
  try {
    const url = new URL(request.url);
    return url.pathname + url.search;
  } catch {
    return request.url;
  }
}

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function logServerError(requestId: string, request: Request, error: unknown) {
  const url = requestPath(request);
  // eslint-disable-next-line no-console
  console.error(`[ssr:${requestId}] ${request.method} ${url} ->`, formatServerError(error));
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  requestId: string,
  request: Request,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  logServerError(
    requestId,
    request,
    consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`),
  );
  return new Response(renderErrorPage(requestId), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8", "x-request-id": requestId },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const requestId = request.headers.get("x-request-id") ?? newRequestId();
    const url = requestPath(request);
    try {
      console.info(`[ssr-step:${requestId}] ${request.method} ${url} -> fetch:start`);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      console.info(
        `[ssr-step:${requestId}] ${request.method} ${url} -> fetch:response:${response.status}:${response.headers.get("content-type") ?? ""}`,
      );
      let normalized = await normalizeCatastrophicSsrResponse(response, requestId, request);
      normalized = applySecurityHeaders(normalized, requestHost(request));
      if (!normalized.headers.has("x-request-id")) {
        normalized.headers.set("x-request-id", requestId);
      }
      console.info(
        `[ssr-step:${requestId}] ${request.method} ${url} -> fetch:done:${normalized.status}`,
      );
      return normalized;
    } catch (error) {
      logServerError(requestId, request, error);
      return new Response(renderErrorPage(requestId), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8", "x-request-id": requestId },
      });
    }
  },
};
