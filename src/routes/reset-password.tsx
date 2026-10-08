import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — GESTI-one" },
      { name: "description", content: "Réinitialisez le mot de passe de votre compte GESTI-one." },
      { property: "og:title", content: "Mot de passe oublié — GESTI-one" },
      { property: "og:description", content: "Réinitialisez le mot de passe de votre compte GESTI-one." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

const inputCls =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setRecovery(true);
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setMsg("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    // Message identique dans tous les cas pour ne pas révéler l'existence d'un compte.
    if (error && /rate/i.test(error.message)) setErr("Trop de demandes. Réessayez dans quelques minutes.");
    else setMsg("Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.");
  }

  async function savePwd(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) { setErr("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setBusy(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) { setErr("Impossible d'enregistrer le mot de passe. Le lien a peut-être expiré."); return; }
    navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[400px] rounded-[12px] border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-2 text-[20px] font-semibold text-foreground">
          {recovery ? "Nouveau mot de passe" : "Mot de passe oublié"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {recovery ? "Choisissez un nouveau mot de passe." : "Saisissez votre adresse e-mail pour recevoir un lien."}
        </p>
        {err && <div role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{err}</div>}
        {msg && <div role="status" className="mb-4 rounded-md border border-border bg-muted px-3 py-2.5 text-sm text-foreground">{msg}</div>}
        <form className="space-y-4" onSubmit={recovery ? savePwd : sendLink} noValidate>
          {recovery ? (
            <div className="space-y-1.5">
              <label htmlFor="new-pwd" className="block text-sm font-medium text-foreground">Nouveau mot de passe</label>
              <input id="new-pwd" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} className={inputCls} required />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="block text-sm font-medium text-foreground">Adresse e-mail</label>
              <input id="reset-email" type="email" inputMode="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
            </div>
          )}
          <Button type="submit" disabled={busy} className="h-11 w-full shadow-none">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {recovery ? "Enregistrer" : "Envoyer le lien"}
          </Button>
        </form>
        <a href="/auth" className="mt-6 block text-center text-xs text-primary hover:underline">Retour à la connexion</a>
      </div>
    </div>
  );
}
