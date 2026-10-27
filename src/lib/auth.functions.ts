import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

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
const WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_EMAIL = 5;
export const MAX_FAILS_PER_IP = 20;

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
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const [byEmail, byIp] = await Promise.all([
      supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true })
        .eq("email", data.email).gte("created_at", since),
      ip
        ? supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true })
            .eq("ip", ip).gte("created_at", since)
        : Promise.resolve({ count: 0 }),
    ]);
    if ((byEmail.count ?? 0) >= MAX_FAILS_PER_EMAIL || (byIp.count ?? 0) >= MAX_FAILS_PER_IP) {
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