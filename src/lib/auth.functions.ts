import { createServerFn } from "@tanstack/react-start";
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

    if (error) throw new Error(error.message);
    if (!authData.session) throw new Error("Session introuvable après connexion");

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: authData.user?.id ?? "",
        email: authData.user?.email ?? data.email,
      },
    };
  });