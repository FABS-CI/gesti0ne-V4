import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { fetchAllPages } from "@/hooks/use-dashboard-overview";

describe("fetchAllPages", () => {
  it("lit toutes les pages au-delà de 1 000 lignes", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => i);
    const ranges: [number, number][] = [];
    const all = await fetchAllPages((from, to) => {
      ranges.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    });
    expect(all).toHaveLength(2500);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("remonte l'erreur au lieu de renvoyer une liste vide", async () => {
    const err = new Error("RLS");
    await expect(
      fetchAllPages(() => Promise.resolve({ data: null, error: err })),
    ).rejects.toBe(err);
  });
});
