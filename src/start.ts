import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { enforceActiveAccount } from "@/lib/account-status-middleware";

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  const requestId = getRequestHeader("x-request-id") ?? newRequestId();
  try {
    setResponseHeader("x-request-id", requestId);
  } catch {
    /* ignore — header may already be committed */
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // eslint-disable-next-line no-console
    console.error(`[req:${requestId}] ${request.method} ${request.url} ->`, error);
    return new Response(renderErrorPage(requestId), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8", "x-request-id": requestId },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, enforceActiveAccount],
  requestMiddleware: [errorMiddleware],
}));
