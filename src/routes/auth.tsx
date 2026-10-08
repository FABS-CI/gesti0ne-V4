import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import fabsLogo from "@/assets/fabs-logo.webp";
import { LoginStyles } from "@/components/auth/LoginStyles";
import { LoginForm } from "@/components/auth/LoginForm";
import { applyRememberPolicy, initRememberPolicyFromStorage } from "@/lib/auth/remember";
import { signInWithPasswordServer } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — ERP FABS-CI" },
      { name: "description", content: "Espace de connexion de l'ERP des Éditions FABS-CI." },
    ],
    links: [
      { rel: "preload", as: "image", href: fabsLogo, fetchPriority: "high" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const signInServer = useServerFn(signInWithPasswordServer);

  const prefetchHotRoutes = () => {
    const hot = ["/dashboard", "/commandes", "/factures"] as const;
    for (const to of hot) {
      router.preloadRoute({ to }).catch(() => {});
    }
  };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [idleTimeout, setIdleTimeout] = useState(false);
  const [remember, setRemember] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  function isFetchProxyError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return /failed to fetch|networkerror|load failed|fetch|auth_client_timeout|timeout|délai/i.test(
      message,
    );
  }

  function withAuthTimeout<T>(promise: Promise<T>, ms = 3500): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error("auth_client_timeout"));
      }, ms);

      promise.then(
        (value) => {
          window.clearTimeout(timeoutId);
          resolve(value);
        },
        (reason) => {
          window.clearTimeout(timeoutId);
          reject(reason);
        },
      );
    });
  }

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has("password") || currentUrl.searchParams.has("email")) {
      currentUrl.searchParams.delete("password");
      currentUrl.searchParams.delete("email");
      window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
    const reason = new URLSearchParams(window.location.search).get("reason");
    setIdleTimeout(reason === "idle_timeout");
    if (reason === "account_disabled") {
      setError("Votre compte a été désactivé. Contactez l'administrateur.");
    }
    try {
      const saved = localStorage.getItem("auth:remember-email");
      if (saved) {
        setEmail(saved);
        setRemember(true);
      } else if (localStorage.getItem("auth:remember") === "0") {
        setRemember(false);
      }
    } catch {
      /* ignore */
    }
    initRememberPolicyFromStorage();
    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (data.session) {
          await navigate({ to: "/dashboard", replace: true });
          return;
        }
        setAuthReady(true);
      })
      .catch((sessionError) => {
        console.warn("[auth] Vérification de session indisponible", sessionError);
        setAuthReady(true);
      });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    // Fallback FormData: browser autofill may set input values without firing
    // React onChange, leaving controlled state empty at submit time.
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const emailVal = (email || String(fd.get("email") ?? "")).trim().toLowerCase();
    const passwordVal = password || String(fd.get("password") ?? "");
    if (emailVal) setEmail(emailVal);
    if (passwordVal && passwordVal !== password) setPassword(passwordVal);
    if (!emailVal || !passwordVal) {
      setError("Email et mot de passe requis");
      return;
    }
    setSubmitting(true);
    try {
      let signInData: { user?: { id?: string; email?: string | null } | null } = {};
      try {
        const { data, error } = (await withAuthTimeout(
          supabase.auth.signInWithPassword({
            email: emailVal,
            password: passwordVal,
          }),
        )) as any;
        if (error) throw error;
        signInData = data;
      } catch (err) {
        if (!isFetchProxyError(err)) throw err;
        const fallback = await signInServer({ data: { email: emailVal, password: passwordVal } });
        const { data, error } = await supabase.auth.setSession({
          access_token: fallback.accessToken,
          refresh_token: fallback.refreshToken,
        });
        if (error) throw error;
        signInData = { user: data.user ?? fallback.user };
      }
      try {
        if (remember) {
          localStorage.setItem("auth:remember-email", emailVal);
          localStorage.setItem("auth:remember", "1");
        } else {
          localStorage.removeItem("auth:remember-email");
          localStorage.setItem("auth:remember", "0");
        }
      } catch {
        /* ignore */
      }
      applyRememberPolicy(remember);
      toast.success("Connexion réussie");
      const uid = signInData.user?.id ?? "";
      const who = signInData.user?.email ?? email.trim().toLowerCase();
      const flagKey = `notif-login-sent:${uid}`;
      let loginAlreadyLogged = false;
      try {
        loginAlreadyLogged = sessionStorage.getItem(flagKey) === "1";
        if (uid && !loginAlreadyLogged) sessionStorage.setItem(flagKey, "1");
      } catch {
        /* Le journal serveur reste fonctionnel si le stockage iframe est bloqué. */
      }
      if (uid && !loginAlreadyLogged) {
        void (async () => {
          const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
          const device = /Mobi|Android|iPhone/i.test(ua)
            ? "Mobile"
            : /iPad|Tablet/i.test(ua)
              ? "Tablette"
              : "Ordinateur";
          let ip: string | undefined;
          try {
            const r = await fetch("https://api.ipify.org?format=json", {
              signal: AbortSignal.timeout(2500),
            });
            if (r.ok) ip = (await r.json()).ip ?? undefined;
          } catch {
            /* ignore */
          }
          void device;
          const { error: logErr } = await supabase.rpc("log_user_login", {
            _email: who,
            _ip: ip,
            _ua: ua,
          });
          if (logErr) {
            try {
              sessionStorage.removeItem(flagKey);
            } catch {
              /* ignore */
            }
            console.warn("[auth] log_user_login échoué:", logErr.message);
          } else {
            console.info("[auth] connexion journalisée pour", who);
          }
        })();
      } else {
        console.info("[auth] notif déjà envoyée pour cette session, skip.");
      }
      await router.invalidate();
      // Redirection adaptative : envoyer l'utilisateur vers son dashboard
      // métier le plus pertinent selon ses permissions (H1 audit MEP).
      let landing: string = "/dashboard";
      try {
        const uidForPerm = signInData.user?.id;
        if (uidForPerm) {
          const [{ data: rpcPerms }, { data: roleRow }] = await Promise.all([
            supabase.rpc("list_user_permissions", { _user_id: uidForPerm }),
            supabase.from("rbac2_user_roles").select("role_code").eq("user_id", uidForPerm).eq("role_code", "super_admin").maybeSingle(),
          ]);
          const codes = (rpcPerms ?? []).map((r: { permission_code: string }) => r.permission_code);
          const { pickLandingRoute } = await import("@/lib/dashboard-landing");
          landing = pickLandingRoute(codes, !!roleRow);
        }
      } catch {
        /* fallback silencieux sur /dashboard */
      }
      // TanStack Router valide `to` en littéral : dispatch explicite pour rester typé.
      switch (landing) {
        case "/dashboard-global": navigate({ to: "/dashboard-global", replace: true }); break;
        case "/dashboard-logistique": navigate({ to: "/dashboard-logistique", replace: true }); break;
        case "/paie-dashboard": navigate({ to: "/paie-dashboard", replace: true }); break;
        case "/rh-dashboard": navigate({ to: "/rh-dashboard", replace: true }); break;
        case "/compta-dashboard": navigate({ to: "/compta-dashboard", replace: true }); break;
        default: navigate({ to: "/dashboard", replace: true });
      }

      setTimeout(prefetchHotRoutes, 0);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /invalid login credentials/i.test(msg)
          ? "Adresse e-mail ou mot de passe incorrect."
          : /email not confirmed/i.test(msg)
            ? "Adresse e-mail non confirmée."
            : msg || "Échec de l'authentification",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!authReady) {
    return (
      <div
        className="login-page-root flex min-h-dvh w-full items-center justify-center bg-background"
        aria-busy="true"
        aria-label="Vérification de la session"
      >
        <img
          src={fabsLogo}
          alt="Logo Éditions FABS-CI"
          width={48}
          height={48}
          loading="eager"
          fetchPriority="high"
          className="h-12 w-12 object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className="login-page-root flex min-h-dvh w-full items-center justify-center bg-background px-4 py-8"
      data-testid="login-page"
    >
      <LoginStyles />
      <div
        data-testid="login-card"
        className="login-card-box w-full max-w-[400px] rounded-[12px] border border-border bg-card p-8"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={fabsLogo}
            alt="Logo Éditions FABS-CI"
            width={44}
            height={44}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="mb-4 h-11 w-11 object-contain"
          />
          <h1 className="font-sans text-[20px] font-semibold tracking-normal text-foreground">Connexion</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entrez vos identifiants pour continuer</p>
        </div>

        <LoginForm
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          showPwd={showPwd}
          setShowPwd={setShowPwd}
          submitting={submitting}
          error={error}
          idleTimeout={idleTimeout}
          onSubmit={handleSubmit}
          remember={remember}
          setRemember={setRemember}
          authReady={authReady}
        />

        <p className="mt-6 text-center text-xs text-muted-foreground">Éditions FABS-CI · GESTI-one</p>
      </div>
    </div>
  );
}
