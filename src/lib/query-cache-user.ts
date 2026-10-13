/**
 * Cache local des requêtes cloisonné par utilisateur (Lot 2.5).
 * Le buster contient l'identifiant de l'utilisateur : un cache écrit par un
 * compte n'est jamais relu par un autre compte sur le même appareil.
 */
export const QUERY_CACHE_STORAGE_KEY = "fabs-query-cache";
const BUSTER_VERSION = "v3";

export function queryCacheBuster(userId: string | null | undefined): string {
  return `${BUSTER_VERSION}:${userId ?? "anonyme"}`;
}

/** Supprime le cache persistant (localStorage). Sans effet côté serveur. */
export function removePersistedQueryCache(storage?: Pick<Storage, "removeItem">) {
  const target = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
  try {
    target?.removeItem(QUERY_CACHE_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}

/** Vrai si l'utilisateur a changé (connexion, déconnexion ou changement de compte). */
export function userChanged(previous: string | null | undefined, next: string | null): boolean {
  return previous !== undefined && previous !== next;
}
