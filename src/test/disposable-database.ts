/** Integration tests may only connect to explicitly opted-in, local disposable databases. */
export function disposableDatabaseUrl(env: Record<string, string | undefined>): string | null {
  if (env.GESTI0NE_RUN_DB_TESTS !== "disposable") return null;
  const raw = env.GESTI0NE_TEST_DATABASE_URL;
  if (!raw) throw new Error("Une base de test jetable explicite est obligatoire");
  const url = new URL(raw);
  if (!(["postgres:", "postgresql:"].includes(url.protocol)) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !/^gesti0ne_test_[a-z0-9_]+$/.test(url.pathname.slice(1))) {
    throw new Error("Tests refusés : seule une base locale gesti0ne_test_* est autorisée");
  }
  return raw;
}