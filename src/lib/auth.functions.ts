import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { isLoginBlocked, LOGIN_WINDOW_MS } from "@/lib/login-rate-limit";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

const GENERIC_ERROR = "Identifiants invalides ou trop de tentatives";

function clientIp(): string | null {
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf.trim().slice(0, 64);
  const xff = getRequestHeader("x-forwarded-for");
  return xff ? xff.split(",")[0]!.trim().slice(0, 64) : null;
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1).max(512),
});

export const signInWithPasswordServer = createServerFn({ method: "POST" })
  .inputValidator((raw) => signInSchema.parse(raw))
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Configuration d'authentification indisponible");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = clientIp();
    const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
    const recentFails = () =>
      supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true })
        .gte("created_at", since);
    const [byEmailIp, byEmail, byIp] = await Promise.all([
      ip ? recentFails().eq("email", data.email).eq("ip", ip)
        : recentFails().eq("email", data.email).is("ip", null),
      recentFails().eq("email", data.email),
      ip ? recentFails().eq("ip", ip) : Promise.resolve({ count: 0 }),
    ]);
    if (isLoginBlocked({
      emailIp: byEmailIp.count ?? 0,
      email: byEmail.count ?? 0,
      ip: byIp.count ?? 0,
    })) {
      throw new Error(GENERIC_ERROR);
    }

    const supabasePublic = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: createSupabaseFetch(supabaseKey),
      },
    });

    const { data: authData, error } = await supabasePublic.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error || !authData.session) {
      await supabaseAdmin.from("login_attempts").insert({ email: data.email, ip });
      throw new Error(GENERIC_ERROR);
    }

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: authData.user?.id ?? "",
        email: authData.user?.email ?? data.email,
      },
    };
  });