import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import loginBg from "@/assets/login-bg.webp";
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
      { rel: "preload", as: "image", href: loginBg, fetchPriority: "high" },
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
            _ip: ip ?? null,
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
      setError(err instanceof Error ? err.message : "Échec de l'authentification");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authReady) {
    return (
      <div
        className="login-page-root relative flex min-h-dvh w-full items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${loginBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#0d1b2a",
        }}
        aria-busy="true"
        aria-label="Vérification de la session"
      >
        <LoginStyles />
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(150deg, #FFF4EC 0%, #F5F7FB 100%)",
            boxShadow: "0 10px 26px rgba(7,27,77,0.28)",
          }}
        >
          <img
            src={fabsLogo}
            alt="Logo Éditions FABS-CI"
            width={64}
            height={64}
            loading="eager"
            fetchPriority="high"
            className="h-16 w-16 object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="login-page-root relative flex min-h-dvh w-full overflow-hidden"
      style={{
        backgroundImage: `url(${loginBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#0d1b2a",
      }}
      data-testid="login-page"
    >
      <LoginStyles />

      <div
        aria-hidden
        className="login-overlay-mobile absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(13,27,42,0.0) 0%, rgba(13,27,42,0.06) 35%, rgba(13,27,42,0.10) 50%, rgba(13,27,42,0.05) 65%, rgba(13,27,42,0.0) 100%)",
        }}
      />

      <div className="login-page-shell relative z-10 flex min-h-dvh items-center py-8 sm:py-10">
        <div
          data-testid="login-card"
          className="login-card-box relative z-10"
          style={{
            background:
              "linear-gradient(165deg, rgba(255,255,255,0.99) 0%, rgba(245,248,253,0.97) 100%)",
            border: "1px solid rgba(255,255,255,0.7)",
            borderRadius: 28,
            boxShadow: "0 30px 90px rgba(7,27,77,0.38), 0 2px 0 rgba(255,98,0,0.25) inset",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "44%",
              height: 4,
              background: "linear-gradient(90deg, transparent, #FF6200, transparent)",
              borderRadius: 99,
            }}
          />
          <div className="mb-8 text-center">
            <div className="mb-7 flex justify-center">
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full"
                style={{
                  background: "linear-gradient(150deg, #FFF4EC 0%, #F5F7FB 100%)",
                  boxShadow: "0 10px 26px rgba(255,98,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
                }}
              >
                <img
                  src={fabsLogo}
                  alt="Logo Éditions FABS-CI"
                  width={64}
                  height={64}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="h-16 w-16 object-contain"
                />
              </div>
            </div>

            <h1
              className="login-card-title slogan-animate"
              style={{ fontWeight: 800, color: "#071B4D", letterSpacing: 0 }}
            >
              Accédez à votre espace
            </h1>
            <p className="fade-up d5" style={{ fontSize: 15, color: "#56627A", marginTop: 10 }}>
              Veuillez renseigner vos identifiants pour continuer
            </p>
            <div
              style={{
                width: 64,
                height: 4,
                background: "#FF6200",
                borderRadius: 99,
                margin: "20px auto 0",
              }}
            />
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
        </div>
      </div>
    </div>
  );
}
