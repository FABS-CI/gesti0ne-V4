import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { assertActiveAccount } from "./account-status";

/** Public calls without bearer remain public; every supplied bearer is validated. */
export const enforceActiveAccount = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const authorization = getRequestHeader("authorization");
  if (!authorization) return next();
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1];
  if (!token) throw new Error("Unauthorized");
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Service d’accès indisponible");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: identity, error: identityError } = await client.auth.getUser(token);
  if (identityError || !identity.user) throw new Error("Unauthorized");
  const { data, error } = await client.from("profiles").select("statut,actif")
    .eq("id", identity.user.id).maybeSingle();
  if (error) throw new Error("Service d’accès indisponible");
  assertActiveAccount(data);
  return next();
});