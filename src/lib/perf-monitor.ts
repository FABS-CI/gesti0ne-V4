import { getCurrentUser } from "@/lib/current-user";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wrap a critical async query to log its duration/errors into perf_query_log.
 * Fire-and-forget: never blocks or throws from the logging side.
 */
export async function trackQuery<T>(
  queryName: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const started = performance.now();
  let error: string | null = null;
  let rowCount: number | null = null;
  try {
    const result = await fn();
    if (Array.isArray(result)) rowCount = result.length;
    else if (result && typeof result === "object" && "length" in (result as object)) {
      const len = (result as { length?: unknown }).length;
      if (typeof len === "number") rowCount = len;
    }
    return result;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    const duration = performance.now() - started;
    void logPerf({ queryName, duration, rowCount, error, metadata });
  }
}

async function logPerf(entry: {
  queryName: string;
  duration: number;
  rowCount: number | null;
  error: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { data: userData } = await getCurrentUser();
    await supabase.from("perf_query_log").insert({
      query_key: entry.queryName,
      duration_ms: Math.round(entry.duration * 100) / 100,
      error: entry.error,
      status: entry.error ? "error" : "ok",
      metadata: {
        ...(entry.metadata ?? {}),
        row_count: entry.rowCount,
        user_id: userData.user?.id ?? null,
      } as never,
    });
  } catch {
    // silent — monitoring must never break the app
  }
}
