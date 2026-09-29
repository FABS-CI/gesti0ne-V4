import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

// Contexte minimal utilisé : évite de dépendre du type SupabaseClient complet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role_compat", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error || data !== true) throw new Response("Forbidden", { status: 403 });
}

function creds() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GDRIVE_KEY = process.env.GOOGLE_DRIVE_API_KEY;
  if (!LOVABLE_API_KEY || !GDRIVE_KEY) {
    throw new Error("Connecteur Google Drive non configuré (secrets manquants)");
  }
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GDRIVE_KEY,
  } as const;
}

export const checkGoogleDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const headers = creds();
    const res = await fetch(
      `${GATEWAY}/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive)`,
      { headers },
    );
    const text = await res.text();
    if (!res.ok) {
      return { ok: false as const, status: res.status, error: text };
    }
    const info = JSON.parse(text) as {
      user?: { displayName?: string; emailAddress?: string; photoLink?: string };
      storageQuota?: { limit?: string; usage?: string; usageInDrive?: string };
    };
    return {
      ok: true as const,
      status: res.status,
      user: info.user ?? null,
      quota: info.storageQuota ?? null,
    };
  });

export const testGoogleDriveUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const headers = creds();
    const boundary = `----lovable-${crypto.randomUUID()}`;
    const meta = {
      name: `fabs_test_${new Date().toISOString()}.txt`,
      mimeType: "text/plain",
      description: "Test d'écriture — validation connecteur FABS-CI",
    };
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `Test OK ${new Date().toISOString()}` +
      `\r\n--${boundary}--`;

    const upRes = await fetch(
      `${GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`,
      {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const upText = await upRes.text();
    if (!upRes.ok) return { ok: false as const, status: upRes.status, error: upText };
    const info = JSON.parse(upText) as { id: string; name: string; webViewLink?: string };

    // Cleanup pour ne pas polluer le Drive
    await fetch(`${GATEWAY}/drive/v3/files/${info.id}`, {
      method: "DELETE",
      headers,
    });

    return { ok: true as const, id: info.id, name: info.name, url: info.webViewLink ?? null };
  });