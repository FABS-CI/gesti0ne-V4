import { removePersistedQueryCache } from "@/lib/query-cache-user";

function clearLocalAuthState() {
  if (typeof window === "undefined") return;

  // Lot 2.5 : aucune donnée métier du compte ne reste sur l'appareil.
  // (La page est rechargée juste après : le cache mémoire disparaît avec elle.)
  removePersistedQueryCache(window.localStorage);

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith("sb-") && key.endsWith("-auth-token")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore storage failures */
  }

  // Réinitialise le flag "notif de connexion envoyée" pour la prochaine session.
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith("notif-login-sent:")) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore storage failures */
  }

  try {
    document.cookie.split(";").forEach((part) => {
      const name = part.split("=")[0]?.trim();
      if (name?.startsWith("sb-")) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    });
  } catch {
    /* ignore cookie failures */
  }
}

export function signOutAndRedirect(reason?: "idle_timeout" | "account_disabled") {
  clearLocalAuthState();

  const target =
    reason === "idle_timeout"
      ? "/auth?reason=idle_timeout"
      : reason === "account_disabled"
        ? "/auth?reason=account_disabled"
        : "/auth";
  window.location.replace(target);
}
