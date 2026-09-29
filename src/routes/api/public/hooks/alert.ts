import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-alert-secret",
};

type AlertPayload = {
  source?: string;
  severity?: "info" | "warning" | "error" | "critical";
  title?: string;
  message?: string;
  context?: Record<string, unknown>;
};

export const Route = createFileRoute("/api/public/hooks/alert")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const secret = process.env.ALERT_WEBHOOK_SECRET;
        if (!secret) {
          return new Response(JSON.stringify({ error: "Endpoint not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        const provided = request.headers.get("x-alert-secret");
        const encoder = new TextEncoder();
        const a = encoder.encode(provided || "");
        const b = encoder.encode(secret);
        
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        let body: AlertPayload;
        try {
          body = (await request.json()) as AlertPayload;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const severity = body.severity ?? "warning";
        if (!["info", "warning", "error", "critical"].includes(severity)) {
          return new Response(JSON.stringify({ error: "Invalid severity" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
        if (!body.title || typeof body.title !== "string") {
          return new Response(JSON.stringify({ error: "Missing title" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("incident_alerts")
          .insert({
            source: (body.source ?? "webhook").slice(0, 100),
            severity,
            title: body.title.slice(0, 500),
            message: body.message?.slice(0, 5000) ?? null,
            metadata: (body.context ?? {}) as never,
          })
          .select("id")
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: "Insert failed", detail: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }

        // Optional Slack forward — no-op if SLACK_ALERT_WEBHOOK_URL not set.
        const slackUrl = process.env.SLACK_ALERT_WEBHOOK_URL;
        if (slackUrl) {
          try {
            await fetch(slackUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `[${severity.toUpperCase()}] ${body.title}${body.message ? `\n${body.message}` : ""}`,
              }),
            });
          } catch {
            // Non-blocking
          }
        }

        return new Response(JSON.stringify({ ok: true, id: data?.id }), {
          status: 201,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      },
    },
  },
});
